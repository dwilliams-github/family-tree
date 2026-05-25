import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as dlm from 'aws-cdk-lib/aws-dlm';
import { Construct } from 'constructs';

const SUBDOMAIN      = 'tree';
const HOSTED_ZONE_NAME = 'slashdave.com';
const HOSTED_ZONE_ID   = 'Z09873553H2BGF8RX2UR8';
const FQDN           = `${SUBDOMAIN}.${HOSTED_ZONE_NAME}`;

export class EC2Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ── S3 backup bucket (pg_dump weekly) ───────────────────────────────────
    const backupBucket = new s3.Bucket(this, 'BackupBucket', {
      bucketName: `family-tree-backups-${this.account}`,
      lifecycleRules: [{ expiration: cdk.Duration.days(90) }],
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ── IAM instance role ────────────────────────────────────────────────────
    const role = new iam.Role(this, 'InstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        // SSM Session Manager — SSH alternative, also required by some tooling
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });

    backupBucket.grantWrite(role);

    // ── VPC + Security Group ─────────────────────────────────────────────────
    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVPC', { isDefault: true });

    const sg = new ec2.SecurityGroup(this, 'InstanceSG', {
      vpc,
      description: 'Family tree EC2 — HTTP/HTTPS public, SSH restricted',
      allowAllOutbound: true,
    });
    sg.addIngressRule(ec2.Peer.anyIpv4(),  ec2.Port.tcp(80),  'HTTP');
    sg.addIngressRule(ec2.Peer.anyIpv6(),  ec2.Port.tcp(80),  'HTTP IPv6');
    sg.addIngressRule(ec2.Peer.anyIpv4(),  ec2.Port.tcp(443), 'HTTPS');
    sg.addIngressRule(ec2.Peer.anyIpv6(),  ec2.Port.tcp(443), 'HTTPS IPv6');
    // SSH: tighten to your IP after first deploy if desired
    sg.addIngressRule(ec2.Peer.anyIpv4(),  ec2.Port.tcp(22),  'SSH');

    // ── EC2 instance (t4g.small / arm64 / Amazon Linux 2023) ────────────────
    const instance = new ec2.Instance(this, 'Instance', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.SMALL),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        cpuType: ec2.AmazonLinuxCpuType.ARM_64,
      }),
      securityGroup: sg,
      role,
      // Root volume: 20 GB gp3 for OS + app files
      blockDevices: [{
        deviceName: '/dev/xvda',
        volume: ec2.BlockDeviceVolume.ebs(20, {
          volumeType: ec2.EbsDeviceVolumeType.GP3,
          encrypted: true,
          deleteOnTermination: true,
        }),
      }],
      // IMDSv2 only
      requireImdsv2: true,
    });

    // ── Separate EBS volume for Postgres data (survives instance replacement) ─
    // On Nitro/t4g, devices attached as /dev/sdf appear as /dev/nvme1n1.
    // User data mounts it at /var/lib/pgsql before initdb runs.
    const dataVolume = new ec2.Volume(this, 'DataVolume', {
      availabilityZone: instance.instanceAvailabilityZone,
      size: cdk.Size.gibibytes(20),
      volumeType: ec2.EbsDeviceVolumeType.GP3,
      encrypted: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,  // never delete Postgres data on stack destroy
    });

    // Tag so DLM snapshot policy picks it up
    cdk.Tags.of(dataVolume).add('Backup', 'true');
    cdk.Tags.of(dataVolume).add('Name', 'family-tree-postgres-data');

    new ec2.CfnVolumeAttachment(this, 'DataVolumeAttachment', {
      volumeId: dataVolume.volumeId,
      instanceId: instance.instanceId,
      device: '/dev/sdf',  // appears as /dev/nvme1n1 on Nitro
    });

    // ── Elastic IP ───────────────────────────────────────────────────────────
    const eip = new ec2.CfnEIP(this, 'ElasticIP', { domain: 'vpc' });

    new ec2.CfnEIPAssociation(this, 'EIPAssociation', {
      allocationId: eip.attrAllocationId,
      instanceId: instance.instanceId,
    });

    // ── Route 53 A record ────────────────────────────────────────────────────
    // CfnRecordSet lets us use the EIP token (a plain ARecord doesn't accept tokens)
    new route53.CfnRecordSet(this, 'DnsRecord', {
      hostedZoneId: HOSTED_ZONE_ID,
      name: `${FQDN}.`,  // trailing dot = fully qualified
      type: 'A',
      ttl: '300',
      resourceRecords: [eip.ref],
    });

    // ── DLM daily snapshot policy for the Postgres volume ───────────────────
    const dlmRole = new iam.Role(this, 'DlmRole', {
      assumedBy: new iam.ServicePrincipal('dlm.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSDataLifecycleManagerServiceRole',
        ),
      ],
    });

    new dlm.CfnLifecyclePolicy(this, 'SnapshotPolicy', {
      description: 'Daily EBS snapshots of Postgres data volume — 7-day retention',
      state: 'ENABLED',
      executionRoleArn: dlmRole.roleArn,
      policyDetails: {
        resourceTypes: ['VOLUME'],
        targetTags: [{ key: 'Backup', value: 'true' }],
        schedules: [{
          name: 'DailySnapshots',
          createRule: {
            interval: 24,
            intervalUnit: 'HOURS',
            times: ['03:00'],  // 3 AM UTC
          },
          retainRule: { count: 7 },
          copyTags: true,
        }],
      },
    });

    // ── User data: OS bootstrap ──────────────────────────────────────────────
    // Runs once on first boot. Sets up Postgres on EBS, Node.js, PM2, Nginx.
    // The actual app is deployed separately (Phase 10 / GitHub Actions).
    instance.addUserData(buildUserData(backupBucket.bucketName, FQDN));

    // ── Outputs ──────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'OutElasticIP',    { value: eip.ref,                   description: 'Elastic IP address' });
    new cdk.CfnOutput(this, 'OutInstanceId',   { value: instance.instanceId,       description: 'EC2 instance ID' });
    new cdk.CfnOutput(this, 'OutDataVolumeId', { value: dataVolume.volumeId,       description: 'Postgres EBS volume ID' });
    new cdk.CfnOutput(this, 'OutBackupBucket', { value: backupBucket.bucketName,   description: 'pg_dump backup bucket' });
    new cdk.CfnOutput(this, 'OutAppURL',       { value: `https://${FQDN}`,         description: 'App URL' });
    new cdk.CfnOutput(this, 'OutSSHCommand',   { value: `ssh ec2-user@${eip.ref}`, description: 'SSH command' });
  }
}

// ── User data script ─────────────────────────────────────────────────────────
// CDK's UserData.forLinux() prepends #!/bin/bash automatically — don't add it.
//
// TypeScript escaping rules for this template literal:
//   ${bucketName} / ${fqdn}  — TypeScript expressions, resolved by CDK/CFn
//   $VAR / $(cmd)            — no braces → pass through to bash unchanged
//   \${BASH_VAR}             — \$ → $ in string, so bash sees ${BASH_VAR}
//   \\$(cmd)                 — \\ → \ in string, so bash heredoc sees \$(cmd)
//                              which means the cron file gets $(cmd) unexpanded
function buildUserData(bucketName: string, fqdn: string): string {
  return (
`set -euo pipefail
exec > >(tee /var/log/user-data.log | logger -t user-data -s) 2>&1

echo "=== Family tree bootstrap starting: $(date) ==="

# ── Wait for data volume (Nitro: /dev/sdf → /dev/nvme1n1) ───────────────────
DATA_DEV=/dev/nvme1n1
for i in $(seq 1 30); do
  [ -b "$DATA_DEV" ] && break
  echo "Waiting for data volume... ($i/30)"
  sleep 2
done
[ -b "$DATA_DEV" ] || { echo "ERROR: data volume not found"; exit 1; }

# ── Format and mount (idempotent) ────────────────────────────────────────────
if ! blkid "$DATA_DEV" 2>/dev/null | grep -q xfs; then
  echo "Formatting $DATA_DEV as xfs"
  mkfs -t xfs "$DATA_DEV"
fi
mkdir -p /var/lib/pgsql
mountpoint -q /var/lib/pgsql || mount "$DATA_DEV" /var/lib/pgsql
grep -qF "$DATA_DEV" /etc/fstab || echo "$DATA_DEV /var/lib/pgsql xfs defaults,nofail 0 2" >> /etc/fstab

# ── PostgreSQL 15 ────────────────────────────────────────────────────────────
dnf install -y postgresql15 postgresql15-server postgresql15-contrib

if [ ! -f /var/lib/pgsql/data/PG_VERSION ]; then
  echo "Initializing Postgres on EBS volume"
  mkdir -p /var/lib/pgsql/data
  chown -R postgres:postgres /var/lib/pgsql
  su - postgres -c "/usr/bin/initdb -D /var/lib/pgsql/data"
  sed -i "s/^#listen_addresses.*/listen_addresses = 'localhost'/" /var/lib/pgsql/data/postgresql.conf
  echo "host family_tree familytree 127.0.0.1/32 md5" >> /var/lib/pgsql/data/pg_hba.conf
  systemctl enable --now postgresql

  PG_PASS=$(openssl rand -base64 24 | tr -d '/+=')

  # Use a temp SQL file to avoid quoting hell with passwords in psql -c
  TMP_SQL=$(mktemp)
  chmod 600 "$TMP_SQL"
  cat > "$TMP_SQL" << SQLEOF
CREATE USER familytree WITH PASSWORD '\${PG_PASS}';
CREATE DATABASE family_tree OWNER familytree;
SQLEOF
  chown postgres "$TMP_SQL"
  su - postgres -c "psql -f $TMP_SQL"
  rm -f "$TMP_SQL"

  mkdir -p /opt/family-tree
  echo "DATABASE_URL=postgresql://familytree:\${PG_PASS}@localhost:5432/family_tree" > /opt/family-tree/db.env
  chmod 600 /opt/family-tree/db.env
  echo "Postgres initialized. Credentials: /opt/family-tree/db.env"
else
  echo "Postgres already initialized — starting service"
  systemctl enable --now postgresql
fi

# ── Node.js 20 (NodeSource RPM) ──────────────────────────────────────────────
if ! node --version 2>/dev/null | grep -q "^v20"; then
  curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
  dnf install -y nodejs
fi
echo "Node: $(node --version)  npm: $(npm --version)"

# ── PM2 ──────────────────────────────────────────────────────────────────────
if ! command -v pm2 &>/dev/null; then
  npm install -g pm2
fi
pm2 startup systemd -u ec2-user --hp /home/ec2-user 2>/dev/null | grep "^sudo" | bash || true
systemctl enable pm2-ec2-user 2>/dev/null || true

# ── Nginx ────────────────────────────────────────────────────────────────────
dnf install -y nginx
rm -f /etc/nginx/conf.d/default.conf

# Single-quoted heredoc → bash does NOT expand $http_upgrade etc. (Nginx vars)
cat > /etc/nginx/conf.d/family-tree.conf << 'NGINXEOF'
server {
    listen 80;
    listen [::]:80;
    server_name ${fqdn};
    client_max_body_size 10M;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINXEOF

systemctl enable --now nginx || systemctl reload nginx

# ── certbot — install now, run manually after DNS propagates ─────────────────
dnf install -y certbot python3-certbot-nginx 2>/dev/null || pip3 install certbot certbot-nginx

# ── App directory (GitHub Actions deploys here) ───────────────────────────────
mkdir -p /opt/family-tree
chown ec2-user:ec2-user /opt/family-tree

# ── Weekly pg_dump to S3 ─────────────────────────────────────────────────────
# \\$( in TypeScript → \$( in script → $( in the written cron file (bash heredoc escape)
cat > /etc/cron.weekly/pg-backup << CRONEOF
#!/bin/bash
source /opt/family-tree/db.env
pg_dump family_tree | gzip | aws s3 cp - s3://${bucketName}/weekly/\\$(date +%Y-%m-%d).sql.gz
CRONEOF
chmod +x /etc/cron.weekly/pg-backup

echo "=== Bootstrap complete: $(date) ==="
echo "Next: certbot --nginx -d ${fqdn} --non-interactive --agree-tos -m admin@slashdave.com"
echo "Then: deploy app via GitHub Actions"
`
  );
}
