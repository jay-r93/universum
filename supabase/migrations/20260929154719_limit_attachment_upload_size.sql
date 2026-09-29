/*
  # Enforce an upload size limit on the attachments bucket

  1. Security
  - The `attachments` bucket had `file_size_limit = NULL`, so the only size gate
    (50 MB) lived in browser code and was bypassed by calling the storage API
    directly with the anon key.
  - Set the bucket limit to 52428800 bytes (50 MB), matching the client constant.
*/

UPDATE storage.buckets
SET file_size_limit = 52428800
WHERE id = 'attachments';
