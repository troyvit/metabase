import { sessionApi, settingsApi } from "metabase/api";
import { createAsyncThunk, createThunkAction } from "metabase/redux/utils";
import type {
  EnterpriseSettingKey,
  EnterpriseSettingValue,
  UserSettings,
} from "metabase-types/api";

type UpdateSettingArg = {
  key: EnterpriseSettingKey;
  value: EnterpriseSettingValue<EnterpriseSettingKey>;
};

export const REFRESH_SITE_SETTINGS = "metabase/settings/REFRESH_SITE_SETTINGS";

export const refreshSiteSettings = createAsyncThunk(
  REFRESH_SITE_SETTINGS,
  async (_, { dispatch }) => {
    const response = await dispatch(
      sessionApi.endpoints.getSessionProperties.initiate(undefined, {
        forceRefetch: true,
      }),
    );
    return response.data;
  },
);

interface UpdateUserSettingProps<K extends keyof UserSettings> {
  key: K;
  value: UserSettings[K];
  shouldRefresh?: boolean;
}

export const UPDATE_USER_SETTING = "metabase/settings/UPDATE_USER_SETTING";
export const updateUserSetting = createAsyncThunk(
  UPDATE_USER_SETTING,
  async (
    {
      key,
      value,
      shouldRefresh = true,
    }: UpdateUserSettingProps<keyof UserSettings>,
    { dispatch },
  ) => {
    // Delegate to the RTK Query mutations. `updateSetting` invalidates the
    // session-properties tag (pessimistic refetch); `updateUserSetting` does an
    // optimistic single-value cache patch with rollback and no refetch — the
    // idiomatic form of the old `shouldRefresh: false` hand-rolled cache write.
    const mutation = shouldRefresh
      ? settingsApi.endpoints.updateSetting
      : settingsApi.endpoints.updateUserSetting;
    await dispatch(
      mutation.initiate({ key, value } as UpdateSettingArg),
    ).unwrap();
  },
);

export const UPDATE_SETTING = "metabase/admin/settings/UPDATE_SETTING";
export const updateSetting = createThunkAction(
  UPDATE_SETTING,
  function (setting: { key: string; value: unknown }) {
    return async function (dispatch: any) {
      await dispatch(
        settingsApi.endpoints.updateSetting.initiate(
          setting as UpdateSettingArg,
        ),
      ).unwrap();
    };
  },
);

export const UPDATE_SETTINGS = "metabase/admin/settings/UPDATE_SETTINGS";
export const updateSettings = createThunkAction(
  UPDATE_SETTINGS,
  function (settings) {
    return async function (dispatch) {
      await dispatch(
        settingsApi.endpoints.updateSettings.initiate(settings),
      ).unwrap();
    };
  },
);
