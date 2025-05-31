# Nova Learning Platform

## Coding Instructions
- Write the absolute minimum code required
- No sweeping changes
- No unrelated edits - focus on just the task you're on
- Make code precise, modular, testable
- Don't break existing functionality 

## Global Components

### Sidebar
The application uses a global Sidebar component (`client/src/components/Sidebar.js`) that should be used consistently across all pages. When integrating the sidebar:

1. Import it at the top of your component:
   ```jsx
   import Sidebar from './Sidebar'; // or '../Sidebar' depending on your file location
   ```

2. Use it with consistent props:
   ```jsx
   <Sidebar
     sidebarOpen={sidebarOpen}
     setSidebarOpen={setSidebarOpen}
     isMobile={isMobile}
     userRole={userRole}
     courses={courses}
     loading={loadingCourses}
     userProfile={{
       first_name,
       last_name,
       profile_picture_url: profilePicture
     }}
     onLogout={logout}
     activePath={currentPath}
   />
   ```

3. Include the related sidebar state:
   ```jsx
   const [sidebarOpen, setSidebarOpen] = useState(false);
   const [isMobile, setIsMobile] = useState(false);
   const [isCollapsed, setIsCollapsed] = useState(false); // Optional for collapsible sidebar
   ```

4. Include the mobile sidebar toggle in your component:
   ```jsx
   {isMobile && (
     <button
       className="sidebar-toggle"
       onClick={() => setSidebarOpen(!sidebarOpen)}
     >
       {sidebarOpen ? <HiOutlineX /> : <HiOutlineMenu />}
     </button>
   )}
   ```

5. Import dashboard CSS to ensure consistent styling:
   ```jsx
   import './dashboard.css'; // or '../dashboard.css' depending on your file location
   ```

The sidebar styling is defined in `dashboard.css` with the class `.dashboard-page .sidebar` to ensure consistency across all pages. 