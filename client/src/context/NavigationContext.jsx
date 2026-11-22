import { createContext, useContext } from 'react';

/** The current page and `navigate(page, param)`, for components deep in the tree (e.g. headers). */
export const NavigationContext = createContext({ page: 'home', navigate: () => {} });

export const useNavigation = () => useContext(NavigationContext);
