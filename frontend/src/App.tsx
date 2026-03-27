import "./App.css"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { Toaster } from "sonner"
import { AppProvider } from "./contexts/AppContext"
import { AuthProvider, useAuth } from "./contexts/AuthContext"
import NavBar from "./components/NavBar"
import AccountsPage from "./pages/AccountsPage"
import ReportsPage from "./pages/ReportsPage"
import CardDetailPage from "./pages/CardDetailPage"
import PromotionsPage from "./pages/PromotionsPage"
import ExpensePage from "./pages/ExpensePage"
import IncomePage from "./pages/IncomePage"
import TransferPage from "./pages/TransferPage"
import AdjustmentPage from "./pages/AdjustmentPage"

function AppShell() {
  const auth = useAuth()

  if (auth === 'authorizing') {
    return (
      <div className="app">
        <div className="app-loading">
          <div className="circle-loading" />
        </div>
      </div>
    )
  }

  if (auth === 'unauthorized') {
    return (
      <div className="app">
        <div className="access-denied">
          <div className="access-denied-badge">Error 401</div>
          <svg className="access-denied-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420">
            <g><g><g><g><path d="M197.8,255.6c-3.18,0-5.76-2.58-5.76-5.76v-74.71c0-10.43,8.49-18.92,18.92-18.92c10.43,0,18.92,8.49,18.92,18.92v33.48c0,3.18-2.58,5.76-5.76,5.76s-5.76-2.58-5.76-5.76v-33.48c0-4.08-3.32-7.4-7.4-7.4s-7.4,3.32-7.4,7.4v74.71C203.56,253.02,200.98,255.6,197.8,255.6z"/></g><g><path d="M250.44,270.22c-3.18,0-5.76-2.58-5.76-5.76v-61.17c0-4.08-3.32-7.4-7.4-7.4s-7.4,3.32-7.4,7.4v46.55c0,3.18-2.58,5.76-5.76,5.76s-5.76-2.58-5.76-5.76v-46.55c0-10.43,8.49-18.92,18.92-18.92s18.92,8.49,18.92,18.92v61.17C256.2,267.64,253.62,270.22,250.44,270.22z"/></g><g><path d="M171.48,268.61c-3.18,0-5.76-2.58-5.76-5.76v-68.34c0-10.43,8.49-18.92,18.92-18.92s18.92,8.49,18.92,18.92c0,3.18-2.58,5.76-5.76,5.76s-5.76-2.58-5.76-5.76c0-4.08-3.32-7.4-7.4-7.4s-7.4,3.32-7.4,7.4v68.34C177.24,266.03,174.66,268.61,171.48,268.61z"/></g><g><path d="M216.5,356.66h-37.4c-10.87,0-21-5.27-28.53-14.85c-7.2-9.17-11.17-21.27-11.17-34.09v-86.01c0-10.43,8.49-18.92,18.92-18.92c5.05,0,9.81,1.97,13.38,5.54s5.54,8.32,5.54,13.38c0,3.18-2.58,5.76-5.76,5.76s-5.76-2.58-5.76-5.76c0-1.98-0.77-3.84-2.17-5.23s-3.26-2.17-5.23-2.17c-4.08,0-7.4,3.32-7.4,7.4v86.01c0,10.25,3.09,19.83,8.71,26.97c5.29,6.74,12.21,10.45,19.47,10.45h37.39c10.89,0,20.88-9.53,26.73-25.5c0.02-0.04,0.03-0.09,0.05-0.13c4.53-11.65,11.56-24.64,20.89-38.63l20.39-30.54c0.82-1.22,1.25-2.64,1.25-4.09c0-2.48-1.23-4.79-3.29-6.17c-3.39-2.26-8-1.35-10.26,2.05l-17.02,25.5c-1.77,2.65-5.34,3.36-7.99,1.59c-2.65-1.77-3.36-5.34-1.59-7.99l17.02-25.5c5.79-8.67,17.56-11.02,26.24-5.23c5.27,3.52,8.42,9.41,8.42,15.75c0,3.74-1.1,7.37-3.19,10.49l-20.38,30.54c-8.85,13.27-15.49,25.5-19.72,36.35v0.01c-3.42,9.31-8.29,17.21-14.09,22.86C233.13,353.15,225.02,356.66,216.5,356.66z"/></g><g><path d="M250.44,270.22c-3.18,0-5.76-2.58-5.76-5.76v-0.03c0-3.18,2.58-5.76,5.76-5.76s5.76,2.58,5.76,5.76v0.03C256.2,267.64,253.62,270.22,250.44,270.22z"/></g></g><g><path d="M385.42,109.99L385.42,109.99l-350.88-0.14c-3.18,0-5.76-2.58-5.76-5.76s2.58-5.76,5.76-5.76l0,0l350.88,0.14c3.18,0,5.76,2.58,5.76,5.76C391.18,107.41,388.6,109.99,385.42,109.99z"/></g><g><path d="M388.82,309.14H258.53c-3.18,0-5.76-2.58-5.76-5.76s2.58-5.76,5.76-5.76h124.53V76.34H37.46v221.28h106.22c3.18,0,5.76,2.58,5.76,5.76s-2.58,5.76-5.76,5.76H31.7c-3.18,0-5.76-2.58-5.76-5.76V70.58c0-3.18,2.58-5.76,5.76-5.76h357.12c3.18,0,5.76,2.58,5.76,5.76v232.8C394.58,306.56,392,309.14,388.82,309.14z"/></g><g><g><path d="M59.78,87.38c0-4.1-3.34-7.44-7.44-7.44s-7.44,3.34-7.44,7.44s3.34,7.44,7.44,7.44S59.78,91.48,59.78,87.38z"/></g><g><path d="M81.86,87.38c0-4.1-3.34-7.44-7.44-7.44s-7.44,3.34-7.44,7.44s3.34,7.44,7.44,7.44C78.52,94.82,81.86,91.48,81.86,87.38z"/></g><g><path d="M103.94,87.38c0-4.1-3.34-7.44-7.44-7.44s-7.44,3.34-7.44,7.44s3.34,7.44,7.44,7.44C100.6,94.82,103.94,87.38,103.94,87.38z"/></g></g></g></g>
          </svg>
          <div className="access-denied-text">
            <span className="access-denied-subtitle">UNAUTHORIZED</span>
            <span className="access-denied-title">You are not supposed to be here!</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AccountsPage/>}/>
            <Route path="/reports" element={<ReportsPage/>}/>
            <Route path="/cards" element={<CardDetailPage/>}/>
            <Route path="/cards/:id" element={<CardDetailPage/>}/>
            <Route path="/promos" element={<PromotionsPage/>}/>
            <Route path="/expense/:accountId" element={<ExpensePage/>}/>
            <Route path="/income/:accountId" element={<IncomePage/>}/>
            <Route path="/transfer/:accountId" element={<TransferPage/>}/>
            <Route path="/adjustment/:accountId" element={<AdjustmentPage/>}/>
          </Routes>
          <NavBar/>
        </BrowserRouter>
      </AppProvider>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: '#1e293b',
            color: '#e2e8f0',
            border: '1px solid #232733',
            marginBottom: "calc(64px + env(safe-area-inset-bottom))",
            justifyContent: "center",
            fontSize: "16px"
          },
        }}
      />
      <AppShell />
    </AuthProvider>
  )
}
