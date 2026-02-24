import "./App.css"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import NavBar from "./components/NavBar"
import AccountsPage from "./pages/AccountsPage"
import ReportsPage from "./pages/ReportsPage"
import CardsPage from "./pages/CardsPage"
import PromotionsPage from "./pages/PromotionsPage"

export default function App() {
  return (
    <div className="app">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AccountsPage/>}/>
          <Route path="/reports" element={<ReportsPage/>}/>
          <Route path="/cards" element={<CardsPage/>}/>
          <Route path="/promos" element={<PromotionsPage/>}/>
        </Routes>
        <NavBar/>
      </BrowserRouter>
    </div>
  )
}