export const LoadingScreen: React.FC = () => (
    <div className="grow flex flex-col justify-center items-center bg-violet-600">
        <span className="material-icons text-3xl text-violet-200 animate-spin">autorenew</span>
        <h3 className="text-large text-violet-400 mt-2 italic">Loading to-dos from slow state store...</h3>
    </div>
);
