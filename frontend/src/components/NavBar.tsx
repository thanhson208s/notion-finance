import './NavBar.css'
import { NavLink } from 'react-router-dom'
import { Home, BarChart } from 'lucide-react'

export default function NavBar() {
  return (
    <nav className="nav-bar">
      <NavLink to="/" className="nav-item">
        <Home size={22} />
      </NavLink>

      <NavLink to="/reports" className="nav-item">
        <BarChart size={22} />
      </NavLink>
    </nav>
  )
}