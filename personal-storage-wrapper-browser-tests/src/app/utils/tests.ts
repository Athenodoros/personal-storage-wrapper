import { DefaultTarget } from "personal-storage-wrapper";
import { TestProps, TestResult } from "../../components/test";
import { AccountTestResults } from "../../hooks/controllers";

export interface TestConfig<T extends DefaultTarget> {
    name: string;
    disabled?: (target: T | undefined) => boolean;
    state?: TestProps["state"];
    runner?: (logger: (log: string) => void, target: T | undefined, addTarget: (target: T) => void) => Promise<boolean>;
}

export const getGetTestSpec =
    <T extends DefaultTarget>(
        target: DefaultTarget["type"],
        selected: T | undefined,
        add: (target: T) => void,
        update: (name: string, result: TestResult | undefined) => void,
        results: AccountTestResults
    ) =>
    ({ name, disabled, runner, state }: TestConfig<T>): TestProps => ({
        target,
        name,
        disabled: disabled ? disabled(selected) : false,
        result: results[name],
        update: (result: TestResult | undefined) => update(name, result),
        runner: runner && ((logger) => runner(logger, selected, add)),
        state,
    });
