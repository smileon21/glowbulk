return (
  <Router>
    <Routes>
      {/* ============================================== */}
      {/* CALLBACK ROUTE — always accessible, no auth    */}
      {/* ============================================== */}
      <Route path="/auth/callback" element={<AuthCallback />} />

      {/* ============================================== */}
      {/* EVERYTHING ELSE — split by auth state         */}
      {/* ============================================== */}
      <Route
        path="*"
        element={
          isAuthenticated ? (
            <div className="App app-with-sidebar">
              <MobileTopbar setSidebarOpen={setSidebarOpen} />

              <Sidebar
                userRole={userRole}
                handleLogout={handleLogout}
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
              />

              {sidebarOpen && (
                <div className="sidebar-overlay open" onClick={() => setSidebarOpen(false)} />
              )}

              <div className="main-wrapper">
                <main className="glow-container">
                  <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/login" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/register" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/announcements" element={<Announcements />} />
                    <Route path="/profile" element={<ProfileRoute />} />
                    <Route path="/security" element={<Security />} />
                    <Route path="/fuel-requests" element={<FuelRequests />} />
                    <Route path="/quotations" element={<Quotations />} />
                    <Route path="/orders" element={<Orders />} />

                    <Route
                      path="/create-order"
                      element={
                        <RoleProtectedRoute allowedRoles={['customer']}>
                          <CreateOrder />
                        </RoleProtectedRoute>
                      }
                    />

                    <Route
                      path="/content"
                      element={
                        <RoleProtectedRoute allowedRoles={['admin', 'marketing']}>
                          <ContentManagement />
                        </RoleProtectedRoute>
                      }
                    />

                    <Route
                      path="/upload-proof/:orderId"
                      element={
                        <RoleProtectedRoute allowedRoles={['customer']}>
                          <UploadProof />
                        </RoleProtectedRoute>
                      }
                    />

                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </main>
                <Footer />
              </div>
            </div>
          ) : (
            <div className="App guest-app">
              <header className="guest-header">
                <Link to="/login" className="guest-logo">
                  <img src="/logo.png" alt="GLOW PETROLEUM" className="header-logo-image" />
                  <div className="logo-text-wrapper">
                    <h1 className="logo-text">
                      GLOW<span className="logo-highlight">BULK</span>
                    </h1>
                    <p className="logo-tagline">We Go Further...</p>
                  </div>
                </Link>
              </header>

              <main className="glow-container">
                <Routes>
                  <Route path="/" element={<Navigate to="/login" replace />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
              </main>

              <Footer />
            </div>
          )
        }
      />
    </Routes>
  </Router>
);