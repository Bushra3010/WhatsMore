// The app's stylesheets load only on the app route, so the admin panel at /admin keeps its own look.
import './styles/styles.css';
import './styles/more.css';
import './styles/blueprint.css';
import './globals.css';
import ClientApp from '@/components/app/ClientApp';

// The app keeps its data in the browser and talks to Supabase from the browser, so the page is a
// client application; the server only sends the shell.
export default function Home() {
  return <ClientApp />;
}
