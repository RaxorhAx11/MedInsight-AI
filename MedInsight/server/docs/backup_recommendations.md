# Production Backup & Recovery Recommendations

This guide describes how to configure, automate, and monitor backup strategies for the MedInsight AI application.

---

## 1. Database Backups (MongoDB)

MedInsight AI relies on MongoDB to store user profiles, parsed biomarker reports, user activities, and chat history.

### Option A: MongoDB Atlas (Recommended for Production)
If you migrate to MongoDB Atlas, backup operations are fully managed.
- **Continuous Backups**: Enable continuous backups in the Atlas Console to get point-in-time recovery (PITR) with 1-minute granularity.
- **On-Demand Snapshots**: Can be triggered manually before major database upgrades or migrations.
- **Retention Policies**: Configure daily, weekly, or monthly snapshots with a retention period (e.g., 7 days for daily, 30 days for weekly).

### Option B: Self-Hosted MongoDB (`mongodump` / `mongorestore`)
If you run MongoDB on a virtual machine or container, you must configure backups manually. We have provided an automation script at `server/scripts/backup.js` that triggers `mongodump` and compresses the outputs.

#### Automated Linux Cron Job Setup
To execute the backup script daily at 2:00 AM, add a cron job:
1. Open the crontab editor:
   ```bash
   crontab -e
   ```
2. Add the following entry (adjust paths to match your environment):
   ```cron
   0 2 * * * cd /var/www/MedInsight/server && /usr/bin/node scripts/backup.js >> logs/backup.log 2>&1
   ```

#### Automated Windows Task Scheduler Setup
1. Open Task Scheduler and select **Create Basic Task**.
2. Set the trigger to **Daily** at a low-traffic hour (e.g., 2:00 AM).
3. Set action to **Start a Program**.
4. In Program/script, enter: `node`
5. In Add arguments, enter: `scripts/backup.js`
6. In Start in, enter the absolute path to your `server` directory (e.g., `C:\MedInsight\server`).

---

## 2. File Uploads Backups

User avatars and parsed PDF reports are uploaded and processed by the server.

### Option A: Cloudinary (Recommended for Production)
When `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` are configured in `.env`, files are automatically uploaded to Cloudinary's cloud storage.
- Cloudinary maintains high-availability backups and geographical replication of all assets.
- No local media backup configurations are required.

### Option B: Local Files Storage (`uploads/` Directory)
If Cloudinary is not configured, the files are stored in the server's local `uploads/` folder.
- **rsync replication**: Sync the `uploads/` folder to a separate storage volume or remote backup target:
  ```bash
  rsync -avz /var/www/MedInsight/server/uploads/ /mnt/backup_volume/uploads/
  ```
- **tar compression**: Archive the folder:
  ```bash
  tar -czf /mnt/backup_volume/uploads_backup_$(date +%F).tar.gz /var/www/MedInsight/server/uploads
  ```

Our `backup.js` script handles zipping this folder automatically if it exists.

---

## 3. Recovery Procedures (How to Restore)

### Restoring MongoDB
To restore a backup created by `mongodump` (which creates a BSON directory or archive):

1. **Extract the backup archive** (if compressed).
2. **Execute `mongorestore`**:
   - For a local database:
     ```bash
     mongorestore --db medinsight ./backups/backup-YYYY-MM-DD-HH-mm-ss/medinsight
     ```
   - For a remote / Atlas cluster:
     ```bash
     mongorestore --uri="mongodb+srv://<user>:<password>@cluster.mongodb.net/medinsight" ./backups/backup-YYYY-MM-DD-HH-mm-ss/medinsight
     ```

### Restoring Local Uploads
To restore a local backup of user uploads:
1. Extract the compressed tarball or zip file containing the `uploads` directory back into the `server` directory:
   ```bash
   tar -xzf /mnt/backup_volume/uploads_backup_YYYY-MM-DD.tar.gz -C /var/www/MedInsight/server/
   ```
2. Verify that permissions allow the Node.js process to read and write to the restored directory.
