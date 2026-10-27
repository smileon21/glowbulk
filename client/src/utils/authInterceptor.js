import axios from 'axios';

// If IT blocks an account, or resets its password, while the person is signed in,
// the server answers 403 with a code on their next click. This signs them out
// and shows a clear message on the login page.

const SIGN_IN_ENDPOINTS = ['/api/auth/login', '/api/auth/verify-otp', '/api/auth/resend-otp'];

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response && error.response.status;
    const data = error.response && error.response.data;
    const url = (error.config && error.config.url) || '';
    const isSignInCall = SIGN_IN_ENDPOINTS.some((path) => url.includes(path));

    if (!isSignInCall && status === 403 && data) {
      if (data.code === 'ACCOUNT_BLOCKED' || data.code === 'PASSWORD_CHANGE_REQUIRED') {
        const notice =
          data.code === 'ACCOUNT_BLOCKED'
            ? data.message
            : 'Your password was reset by IT. Sign in with the temporary password you were given.';

        sessionStorage.setItem('authNotice', notice);
        ['token', 'userRole', 'userName', 'userEmail'].forEach((key) => localStorage.removeItem(key));
        delete axios.defaults.headers.common['Authorization'];
        window.dispatchEvent(new Event('authChange'));
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);
