import { Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import LoadingIndicator from './common/LoadingIndicator';

const PrivateRoute = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(null); // Start with null (loading)
  const [isLoading, setIsLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setIsAuthenticated(false);
          setIsLoading(false);
          return;
        }

        const res = await fetch("http://localhost:5000/auth/is-verify", {
          method: "GET",
          headers: { jwt_token: token }
        });

        const parseRes = await res.json();
        setIsAuthenticated(parseRes === true);
      } catch (err) {
        console.error("Error verifying authentication:", err.message);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    verifyAuth();
  }, []);

  if (isLoading) {
    // Show loading state while checking authentication
    return <LoadingIndicator text="Verifying Authentication" />;
  }

  if (!isAuthenticated) {
    // Redirect to login, but save the current location
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // User is authenticated, render the protected component
  return children;
};

export default PrivateRoute; 