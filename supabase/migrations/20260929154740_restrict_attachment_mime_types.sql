/*
  # Restrict attachment content types on the attachments bucket

  1. Security
  - The `attachments` bucket had `allowed_mime_types = NULL`, so any content type
    (including HTML or executables) could be stored by calling the storage API
    directly. The allowlist existed only in browser code.
  - Set the bucket allowlist to exactly the types the application uploads:
    images, videos, PDF, Word documents and plain text.

  2. Notes
  - The client compresses images to webp and videos to webm, both covered by the
    image and video wildcard entries below.
*/

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/*',
  'video/*',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
]
WHERE id = 'attachments';
