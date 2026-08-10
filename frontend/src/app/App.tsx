import { RouterProvider } from "react-router";
import { router } from "./providers/router";

function App() {
    return <RouterProvider router={router} />;
}

export default App;
