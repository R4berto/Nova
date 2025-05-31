// Add static file serving for uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads'))); 