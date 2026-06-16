import _ from "underscore";

import type {
  EnterpriseSettingKey,
  EnterpriseSettingValue,
  EnterpriseSettings,
  SettingDefinition,
  SettingDefinitionMap,
} from "metabase-types/api";

import { Api } from "./api";
import { sessionApi } from "./session";
import { invalidateTags, listTag, tag } from "./tags";

export const settingsApi = Api.injectEndpoints({
  endpoints: (builder) => ({
    // admin-only endpoint that returns all settings with lots of extra metadata
    getAdminSettingsDetails: builder.query<SettingDefinitionMap, void>({
      query: () => ({
        method: "GET",
        url: "/api/setting",
      }),
      transformResponse: (response: SettingDefinition[]) =>
        _.indexBy(response, "key") as SettingDefinitionMap,
      providesTags: ["session-properties"],
    }),
    getSetting: builder.query<
      EnterpriseSettingValue,
      Exclude<EnterpriseSettingKey, "version-info">
    >({
      query: (name) => ({
        method: "GET",
        url: `/api/setting/${encodeURIComponent(name)}`,
      }),
      providesTags: ["session-properties"],
    }),
    getVersionInfo: builder.query<EnterpriseSettings["version-info"], void>({
      query: () => ({
        method: "GET",
        url: "/api/setting/version-info",
      }),
      // don't provide a tag, this should never be refetched
    }),
    updateSetting: builder.mutation<
      void,
      {
        key: EnterpriseSettingKey;
        value: EnterpriseSettingValue<EnterpriseSettingKey>;
      }
    >({
      query: ({ key, value }) => ({
        method: "PUT",
        url: `/api/setting/${encodeURIComponent(key)}`,
        body: { value },
      }),
      invalidatesTags: (_, error, { key }) => {
        return invalidateTags(error, [
          tag("session-properties"),
          ...(key === "uploads-settings" ? [listTag("database")] : []),
          ...(key === "llm-anthropic-api-key" ? [listTag("llm-models")] : []),

          // Enabling tenants creates the "all-external-users" permission group
          ...(key === "use-tenants" ? [listTag("permissions-group")] : []),
        ]);
      },
    }),
    updateSettings: builder.mutation<void, Partial<EnterpriseSettings>>({
      query: (settings) => ({
        method: "PUT",
        url: `/api/setting`,
        body: settings,
      }),
      invalidatesTags: (_, error) =>
        invalidateTags(error, [
          tag("session-properties"),
          listTag("embedding-hub-checklist"),
        ]),
    }),
    // Optimistic single-value update: patch the session-properties cache
    // immediately and roll back if the PUT fails, *without* invalidating the
    // session-properties tag — so we don't refetch the whole settings payload.
    // This is the idiomatic replacement for the old `shouldRefresh: false` path,
    // which hand-wrote the value into redux with no rollback. Use this for
    // high-frequency UI-driven settings (toggles, dismissed prompts); use
    // `updateSetting` (pessimistic, invalidates) for admin settings.
    updateUserSetting: builder.mutation<
      void,
      {
        key: EnterpriseSettingKey;
        value: EnterpriseSettingValue<EnterpriseSettingKey>;
      }
    >({
      query: ({ key, value }) => ({
        method: "PUT",
        url: `/api/setting/${encodeURIComponent(key)}`,
        body: { value },
      }),
      onQueryStarted: async ({ key, value }, { dispatch, queryFulfilled }) => {
        const patch = dispatch(
          sessionApi.util.updateQueryData(
            "getSessionProperties",
            undefined,
            (draft) => {
              (draft as Record<string, unknown>)[key] = value;
            },
          ),
        );
        queryFulfilled.catch(patch.undo);
      },
    }),
  }),
});

export const {
  useGetSettingQuery,
  useGetVersionInfoQuery,
  useGetAdminSettingsDetailsQuery,
  useUpdateSettingMutation,
  useUpdateSettingsMutation,
  useUpdateUserSettingMutation,
} = settingsApi;
