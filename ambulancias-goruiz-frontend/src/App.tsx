// src/App.tsx
import AppLayout from "./layouts/AppLayout";
import Home from "./pages/Home";
import DienstPage from "./pages/DienstPage";


export default function App() {
  return (
    <AppLayout>
      <Home />
      <DienstPage />
    </AppLayout>
  );
}
      
