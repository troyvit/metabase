import {
  isValidColorScheme,
  setUserColorSchemeAfterUpdate,
} from "metabase/utils/color-scheme";
import MetabaseSettings from "metabase/utils/settings";
import type {
  EnterpriseSettings,
  PasswordResetTokenStatus,
} from "metabase-types/api";

import { Api } from "./api";
import { handleQueryFulfilled } from "./utils/lifecycle";

export const sessionPropertiesPath = "/api/session/properties";

export const sessionApi = Api.injectEndpoints({
  endpoints: (builder) => ({
    getPasswordResetTokenStatus: builder.query<
      PasswordResetTokenStatus,
      string
    >({
      query: (token) => ({
        method: "GET",
        url: "/api/session/password_reset_token_valid",
        body: { token },
      }),
    }),
    forgotPassword: builder.mutation<void, string>({
      query: (email) => ({
        method: "POST",
        url: "/api/session/forgot_password",
        body: { email },
      }),
    }),
    checkPassword: builder.mutation<void, { password: string }>({
      query: (body) => ({
        method: "POST",
        url: "/api/session/password-check",
        body,
      }),
    }),
    getSessionProperties: builder.query<EnterpriseSettings, void>({
      query: () => ({
        method: "GET",
        url: sessionPropertiesPath,
      }),
      providesTags: ["session-properties"],
      onQueryStarted: (_, { queryFulfilled }) =>
        handleQueryFulfilled(queryFulfilled, (data) => {
          // Keep the non-redux settings consumers in sync. `MetabaseSettings`
          // is read by code that runs outside the store/React (i18n, dom
          // helpers, theming).
          MetabaseSettings.setAll(data);

          // Sync color-scheme setting to window.MetabaseUserColorScheme
          if (
            data["color-scheme"] &&
            isValidColorScheme(data["color-scheme"])
          ) {
            setUserColorSchemeAfterUpdate(data["color-scheme"]);
          }
        }),
    }),
  }),
});

export const {
  useGetPasswordResetTokenStatusQuery,
  useForgotPasswordMutation,
  useCheckPasswordMutation,
  useGetSessionPropertiesQuery,
  useLazyGetSessionPropertiesQuery,
} = sessionApi;

// aliases for easier use
export const useGetSettingsQuery = useGetSessionPropertiesQuery;
export const useLazyGetSettingsQuery = useLazyGetSessionPropertiesQuery;

/**
 * Force a refetch of the session properties (settings) from non-React code.
 * Dispatch it: `dispatch(refetchSiteSettings())`. In React, prefer
 * `useLazyGetSettingsQuery()`'s trigger instead.
 */
export const refetchSiteSettings = () =>
  sessionApi.endpoints.getSessionProperties.initiate(undefined, {
    forceRefetch: true,
  });
