import { describe, expect, it } from "vitest";
import { queueApi } from "@/entities/queue";
import { signedIn, signedOut } from "@/entities/session";
import { makeStore } from "./store";

describe("store session changes", () => {
    it("сбрасывает кэш очереди при смене аккаунта", () => {
        const store = makeStore();

        store.dispatch(
            queueApi.util.upsertQueryData("getMyQueueState", "stan-lee", {
                queue_entry_id: "entry-1",
                product_id: "stan-lee",
                ticket_no: 6,
                status: "WAITING",
                position: 6,
                message: "Вы в очереди на этот товар",
                next_action: "Ждите уведомления",
                grant: null,
            }),
        );
        store.dispatch(signedIn({ id: "user-2", name: "Борис", login: "boris" }));

        expect(store.getState()[queueApi.reducerPath].queries).toEqual({});

        store.dispatch(signedOut());
    });
});
