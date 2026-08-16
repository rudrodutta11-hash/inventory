import { useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { getMeta } from './lib/meta';
import Cabinet from './screens/Cabinet';
import BottleDetail from './screens/BottleDetail';
import AddBottle from './screens/AddBottle';
import RankSession from './screens/RankSession';
import RankList from './screens/RankList';
import Graveyard from './screens/Graveyard';
import Wishlist from './screens/Wishlist';
import Settings from './screens/Settings';
import FooterNav from './components/FooterNav';

export default function App() {
  const theme = useLiveQuery(async () => (await getMeta<string>('theme')) ?? 'light', [], 'light');

  useEffect(() => {
    const cellar = theme === 'cellar';
    if (cellar) document.documentElement.dataset.theme = 'cellar';
    else delete document.documentElement.dataset.theme;

    // The in-app theme is a deliberate choice and can disagree with the OS,
    // so drive the status-bar colour from it rather than prefers-color-scheme.
    const paper = cellar ? '#17191A' : '#E5E1D6';
    for (const el of document.querySelectorAll('meta[name="theme-color"]')) {
      el.setAttribute('content', paper);
    }
  }, [theme]);

  useEffect(() => {
    // Layer 1 of not losing the data: ask the browser not to evict us.
    void navigator.storage?.persist?.();
  }, []);

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Cabinet />} />
        <Route path="/b/:serial" element={<BottleDetail />} />
        <Route path="/b/:serial/pour" element={<BottleDetail pourOnOpen />} />
        <Route path="/add" element={<AddBottle />} />
        <Route path="/rank" element={<RankSession />} />
        <Route path="/rank/list" element={<RankList />} />
        <Route path="/graveyard" element={<Graveyard />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
      <FooterNav />
    </HashRouter>
  );
}
