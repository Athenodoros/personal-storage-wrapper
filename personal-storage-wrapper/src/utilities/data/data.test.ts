import { expect, test } from "vitest";
import { deepEquals, deepEqualsList, maxBy, maxByAsync, orderByAsc, orderByDesc, uniq, uniqBy } from ".";

const array = [
    { id: 0, val: 5 },
    { id: 1, val: 7 },
    { id: 2, val: 6 },
    { id: 3, val: 6 },
    { id: 4, val: 4 },
];

test("Check orderByDesc", () => {
    expect(orderByDesc(array, ({ val }) => val)).toEqual([
        { id: 1, val: 7 },
        { id: 2, val: 6 },
        { id: 3, val: 6 },
        { id: 0, val: 5 },
        { id: 4, val: 4 },
    ]);
});

const orderedAscArray = [
    { id: 4, val: 4 },
    { id: 0, val: 5 },
    { id: 3, val: 6 },
    { id: 2, val: 6 },
    { id: 1, val: 7 },
];

test("Check orderByAsc array valuers", () => {
    expect(
        orderByAsc(
            array,
            ({ val }) => val,
            ({ id }) => -id
        )
    ).toEqual(orderedAscArray);
});

test("Check orderBy with undefined", () => {
    const value = { id: -1, val: undefined as number | undefined };

    expect(
        orderByAsc(
            [value].concat(array),
            ({ val }) => val,
            ({ id }) => -id
        )
    ).toEqual((orderedAscArray as { id: number; val: number | undefined }[]).concat([value]));
});

const tiedMaxArray = [
    { id: 0, val: 5 },
    { id: 1, val: 6 },
    { id: 2, val: 7 },
    { id: 3, val: 7 },
    { id: 4, val: 4 },
];

test("Check maxBy value", () => {
    expect(
        maxBy(
            tiedMaxArray,
            ({ val }) => val,
            ({ id }) => id
        )
    ).toEqual({ id: 3, val: 7 });
});

test("Check maxByAsync value", async () => {
    expect(
        await maxByAsync(
            tiedMaxArray,
            async ({ val }) => val,
            async ({ id }) => id
        )
    ).toEqual({ id: 3, val: 7 });
});

test("Check deepEquals", () => {
    expect(
        deepEquals(
            [null, undefined, 0, 7, "", "a", true, false, [], [1, 2, null], {}, { b: [2, 3], a: 1 }],
            [null, undefined, 0, 7, "", "a", true, false, [], [1, 2, null], {}, { a: 1, b: [2, 3] }]
        )
    ).toBe(true);

    expect(deepEquals(null, undefined)).toBe(false);
    expect(deepEquals([], {})).toBe(false);
    expect(deepEquals([] as any, "")).toBe(false);
    expect(deepEquals(1, 2)).toBe(false);
    expect(deepEquals(1, "1" as any)).toBe(false);
    expect(deepEquals(["a", "b"], { 0: "a", 1: "b" })).toBe(false);
});

test("Check deepEqualsList", () => {
    expect(
        deepEqualsList([
            [2, 3, 4],
            [2, 3, 4],
            [2, 3, 4],
        ])
    ).toBe(true);
    expect(
        deepEqualsList([
            [2, 3, 4],
            [2, 3, 4],
            [2, 3, 5],
        ])
    ).toBe(false);
});

test("Check uniq and uniqBy", () => {
    const a = { k: 1 };
    const b = { k: 2 };
    const c = { k: 1 };
    const d = { k: 3 };

    const uniqResult = uniq([a, b, c, a, d]);
    expect(uniqResult.length).toBe(4);
    expect(uniqResult[0]).toBe(a);
    expect(uniqResult[1]).toBe(b);
    expect(uniqResult[2]).toBe(c);
    expect(uniqResult[3]).toBe(d);

    const uniqByResult = uniqBy([a, b, c, d], (x) => x.k);
    expect(uniqByResult.length).toBe(3);
    expect(uniqByResult[0]).toBe(a);
    expect(uniqByResult[1]).toBe(b);
    expect(uniqByResult[2]).toBe(d);
    expect(uniqByResult[0]).not.toBe(c);
});
