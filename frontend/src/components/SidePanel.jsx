import ThemeToggle from "./ThemeToggle";
import GithubButton from './GithubButton';

export default function SidePanel() {
  return (
    <aside className="side-panel">
      <div className="panel-header">
        <ThemeToggle />
        <GithubButton />
      </div>
    </aside>
  );
}