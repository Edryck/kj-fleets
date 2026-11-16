import { useState, type ReactNode } from "react";
import TitleBlock from "../layout/TitleBlock";
import { createTitleBlockStore, TitleBlockContext } from "../layout/titleBlockContext";

export function WithTitleBlock({ children }: { children: ReactNode }) {
    const [store] = useState(createTitleBlockStore);
    return (
        <TitleBlockContext.Provider value={store}>
            <TitleBlock />
            {children}
        </TitleBlockContext.Provider>
    );
}
