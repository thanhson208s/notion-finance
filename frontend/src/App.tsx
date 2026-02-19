import "./App.css"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import Header from "./components/Header"
import NavBar from "./components/NavBar"
import AccountsPage from "./pages/AccountsPage"
import ReportsPage from "./pages/ReportsPage"
import { type AppState, type AppAction, AppContext } from "./App"
import { useReducer } from "react"

export default function App() {
  const [state, dispatch] = useReducer((state: AppState, action: AppAction) => {
    switch(action.type) {
      case 'update':
        return {
          ...state,
          accounts: action.accounts
        };
      default:
        return state;
    }
  }, {accounts: []});
  
  return (
    <div className="app">
      <AppContext.Provider value = {{ state, dispatch }}>
        <BrowserRouter>
          <Header title={
            state.accounts.reduce((sum, acc) => (sum + acc.balance), 0).toLocaleString('vi-VN', {
              style: 'currency', currency: 'VND'
            })
          }/>
          <Routes>
            <Route path="/" element={<AccountsPage/>}/>
            <Route path="/reports" element={<ReportsPage/>}/>
          </Routes>
          <NavBar/>
        </BrowserRouter>
      </AppContext.Provider>
    </div>
  )
}