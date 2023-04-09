import { useState } from "react";
import { ToDoItem } from "./defaults";

export const ToDoDisplay: React.FC<{
    todos: ToDoItem[];
    remove: (id: number) => void;
    add: (text: string) => void;
}> = ({ todos, remove, add }) => {
    const [value, setValue] = useState("");
    const submit = () => {
        add(value);
        setValue("");
    };

    return (
        <div className="flex-1 flex flex-col items-center bg-violet-600 overflow-y-scroll">
            <div className="h-1/6 flex-none w-px" />
            <div className="flex w-96 sticky pt-5 pb-2 top-0 bg-violet-600">
                <input
                    className="bg-transparent border rounded-lg text-white focus:outline-violet-500 p-3 placeholder:italic placeholder:text-violet-300 grow outline-none"
                    placeholder="New to-do item..."
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    onKeyUp={(event) => event.code === "Enter" && submit()}
                />
                <button
                    className="flex border ml-2 rounded-lg w-[50px] flex justify-center items-center hover:bg-violet-700 active:bg-violet-900"
                    onClick={submit}
                >
                    <span className="material-icons text-white">add</span>
                </button>
            </div>
            {todos.map(({ id, text }) => (
                <div key={id} className="rounded-full bg-violet-500 w-96 p-1.5 mt-3 flex items-center">
                    <div className="bg-violet-400 rounded-full w-7 h-7 flex justify-center items-center mr-3">
                        <span className="material-icons text-white text-base">edit</span>
                    </div>
                    <p className="text-violet-50 italic grow">{text}</p>
                    <button
                        className="text-violet-200 rounded-full w-7 h-7 flex justify-center items-center transition hover:text-white hover:bg-violet-700 active:bg-violet-900"
                        onClick={() => remove(id)}
                    >
                        <span className="material-icons">close</span>
                    </button>
                </div>
            ))}
            <div className="h-1/6 flex-none w-px" />
        </div>
    );
};
