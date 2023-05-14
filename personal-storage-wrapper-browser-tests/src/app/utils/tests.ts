import { DefaultTarget } from "personal-storage-wrapper";
import { TestProps, TestResult } from "../../components/test";
import { AccountTestResults } from "../../hooks/controllers";
import { useTargetState } from "../../hooks/targets";

export interface TestConfig<T extends DefaultTarget> {
    name: string;
    disabled?: (target: T | undefined) => boolean;
    state?: TestProps["state"];
    runner: (
        logger: (log: string) => void,
        target: T | undefined,
        addTarget: (target: T) => void,
        targets: T[]
    ) => Promise<boolean>;
}

export const getGetTestSpec =
    <T extends DefaultTarget>(
        targets: ReturnType<typeof useTargetState<T>>,
        update: (name: string, result: TestResult | undefined) => void,
        results: AccountTestResults
    ) =>
    ({ name, disabled, runner, state }: TestConfig<T>): TestProps => ({
        target: targets.type,
        name,
        disabled: disabled ? disabled(targets.selected as T) : false,
        result: results[name],
        update: (result: TestResult | undefined) => update(name, result),
        runner:
            runner &&
            ((logger) =>
                runner(
                    logger,
                    targets.selected as T,
                    targets.add,
                    targets.accounts.map(({ target }) => target as T)
                )),
        state,
    });
