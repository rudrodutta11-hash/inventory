import { NavLink } from 'react-router-dom';

export default function FooterNav() {
  const links = [
    { to: '/', label: 'Cabinet' },
    { to: '/rank', label: 'Rank' },
    { to: '/add', label: 'Add' },
    { to: '/settings', label: 'Settings' },
  ];
  return (
    <nav className="footer-nav no-print" aria-label="Main">
      {links.map((l) => (
        <NavLink key={l.to} to={l.to} end={l.to === '/'}>
          {l.label}
        </NavLink>
      ))}
    </nav>
  );
}
