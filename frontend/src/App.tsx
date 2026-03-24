import "./App.css"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { AppProvider } from "./contexts/AppContext"
import NavBar from "./components/NavBar"
import AccountsPage from "./pages/AccountsPage"
import ReportsPage from "./pages/ReportsPage"
import CardDetailPage from "./pages/CardDetailPage"
import PromotionsPage from "./pages/PromotionsPage"
import ExpensePage from "./pages/ExpensePage"
import IncomePage from "./pages/IncomePage"
import TransferPage from "./pages/TransferPage"
import AdjustmentPage from "./pages/AdjustmentPage"

export default function App() {
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