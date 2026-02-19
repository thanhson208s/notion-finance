import './Header.css'

export default function Header({title}: {title: string}) {
  return (
    <header className="header">
      <button className="icon-btn">☰</button>
      <h1 className="title">{title}</h1>
      <button className="icon-btn">?</button>
    </header>
  );
}