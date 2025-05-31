-- Alter the file_type column in announcement_attachment table to increase length
ALTER TABLE announcement_attachment
ALTER COLUMN file_type TYPE VARCHAR(255);