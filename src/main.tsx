import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { BrandingProvider } from "./branding/BrandingProvider";
import { I18nProvider } from "./i18n/I18nProvider";
import { ThemeProvider } from "./layout/ThemeProvider";
import { ToastProvider } from "./layout/ToastProvider";
import { App } from "./App";
import "bootstrap-icons/font/bootstrap-icons.css";
import "bootstrap/dist/css/bootstrap.min.css";
import "./styles/main.css";
import "./styles/workbench.css";

// A data router, only so pages can hold a navigation with `useBlocker`; the
// routes themselves still live in <App>.
const router = createBrowserRouter([{ path: "*", element: <App /> }]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <ToastProvider>
          <AuthProvider>
            <BrandingProvider>
              <RouterProvider router={router} />
            </BrandingProvider>
          </AuthProvider>
        </ToastProvider>
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>,
);
