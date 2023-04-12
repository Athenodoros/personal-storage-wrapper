import { useState } from "react";

export function App() {
    const [count, setCount] = useState(0);

    return (
        <div className="h-screen w-screen flex justify-center bg-slate-200 py-24">
            <div className="w-[800px]">
                <h1 className="text-4xl">PSM Test Page</h1>
                <h1>Vite + React</h1>
                <div className="card">
                    <button onClick={() => setCount((count) => count + 1)}>count is {count}</button>
                    <p>
                        Edit <code>src/App.tsx</code> and save to test HMR
                    </p>
                </div>
                <p className="read-the-docs">Click on the Vite and React logos to learn more</p>
            </div>
        </div>
    );
}
