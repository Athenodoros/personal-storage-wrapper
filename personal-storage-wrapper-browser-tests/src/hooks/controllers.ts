import { useState } from "react";
import { TestName, TestResult } from "../components/test";
import { getStorageManager } from "../utils/storage";

type AccountTestResults = Record<TestName, TestResult | undefined>;

export interface TestResultsController {
    results: AccountTestResults;
    reset: () => void;
    update: (name: TestName, result: TestResult | undefined) => void;
}

export const useTestResultsController = (name: string): TestResultsController => {
    const storage = getStorageManager<AccountTestResults>(name + "-results");

    const [results, setResultsRaw] = useState(() => storage.load() ?? {});
    const setResults = (update: AccountTestResults) => {
        storage.save(update);
        setResultsRaw(update);
    };

    const reset = () => setResults({});
    const update = (name: TestName, result: TestResult | undefined) => setResults({ ...results, [name]: result });

    return { results, reset, update };
};
