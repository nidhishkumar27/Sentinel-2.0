import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AuthorityRoutes from './features/authority/routes';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/authority/*"
          element={<AuthorityRoutes />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;