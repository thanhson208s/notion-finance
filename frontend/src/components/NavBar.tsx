import './NavBar.css'
import { NavLink } from 'react-router-dom'
import { Home, BarChart, CreditCard, TicketPercent } from 'lucide-react'


export default function NavBar() {
  return (
    <nav className="nav-bar">
      <NavLink to="/" className="nav-item">
        <Home size={22} />
      </NavLink>

      <NavLink to="/reports" className="nav-item">
        <BarChart size={22} />
      </NavLink>

      <NavLink to="/cards" className="nav-item">
        <CreditCard size={22} />
      </NavLink>

      <NavLink to="/promos" className="nav-item">
        <TicketPercent size={22} />
      </NavLink>
    </nav>
  )
}