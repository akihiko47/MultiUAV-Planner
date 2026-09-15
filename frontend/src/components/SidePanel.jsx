import ThemeToggle from "./ThemeToggle";

export default function SidePanel() {
  return (
    <aside className="side-panel">
      <ThemeToggle/>
        <h2>Управление</h2>
        <p>Здесь появятся кнопки для работы с точками.</p>
    </aside>
  );
}