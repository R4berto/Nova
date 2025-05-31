# Setting Up Notification Tables in Your Database

Follow these steps to create the notification tables in your PostgreSQL database:

## Option 1: Using psql (Command Line)

1. Open your command prompt or terminal

2. Connect to your database:
   ```
   psql -U postgres -d nova
   ```
   (Enter your password when prompted)

3. Once connected, run the SQL from the notifications.sql file:
   ```
   \i C:/Users/mjp_p/OneDrive/Documents/Web Development Projects/V12/server/db/notifications.sql
   ```

4. Verify the tables were created:
   ```
   \dt notifications
   \dt notification_preferences
   \dt notification_delivery_log
   ```

## Option 2: Using pgAdmin

1. Open pgAdmin

2. Connect to your PostgreSQL server

3. Select your 'nova' database

4. Right-click on the database and select "Query Tool"

5. Open the file: `C:/Users/mjp_p/OneDrive/Documents/Web Development Projects/V12/server/db/notifications.sql`

6. Click the "Execute" button to run the SQL script

## After Setting Up Tables

Once the tables are created:

1. Restart your server:
   ```
   cd server
   npm start
   ```

2. Your notification system should now work properly without the "relation does not exist" error. 