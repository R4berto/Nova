-- Alter the file_size column in announcement_attachment table to handle larger files
ALTER TABLE announcement_attachment
ALTER COLUMN file_size TYPE BIGINT; 