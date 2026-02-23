import { Navigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

const ProtectedRoute = ({ children, roles }) => {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole'); // Get role from storage

    if (!token) {
        return <Navigate to="/guard/login" replace />;
    }

    try {
        const decoded = jwtDecode(token);

        // Check role from localStorage instead of opaque JWT
        if (roles && !roles.includes(userRole)) {
            return <Navigate to="/guard/login" replace />;
        }

        // Check expiry (JWT still has this)
        if (decoded.exp * 1000 < Date.now()) {
            localStorage.removeItem('token');
            localStorage.removeItem('userRole');
            return <Navigate to="/guard/login" replace />;
        }

        return children;
    } catch (error) {
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        return <Navigate to="/guard/login" replace />;
    }
};

export default ProtectedRoute;
