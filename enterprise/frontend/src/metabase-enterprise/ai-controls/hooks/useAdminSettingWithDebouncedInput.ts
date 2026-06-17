import { useDebouncedCallback } from "@mantine/hooks";
import { useCallback, useEffect, useRef, useState } from "react";
import { c } from "ttag";

import { useAdminSetting } from "metabase/api/utils";
import { useMetadataToasts } from "metabase/metadata/hooks";
import type {
  EnterpriseSettingKey,
  EnterpriseSettingValue,
} from "metabase-types/api";

export const SAVE_DEBOUNCE_MS = 500;

export function useAdminSettingWithDebouncedInput<T>(
  settingName: EnterpriseSettingKey,
  defaultValue: T | null = null,
) {
  const {
    value: settingValue,
    isLoading,
    updateSetting,
  } = useAdminSetting(settingName);
  const [inputValue, setInputValue] = useState<T>(settingValue as T);
  const hasHydrated = useRef(false);
  const hasUserEdited = useRef(false);
  const { sendErrorToast } = useMetadataToasts();

  // Initialise local input state from the setting once it has loaded
  // (`isLoading` is false). `hasUserEdited` keeps this from clobbering a value
  // the user changed before the load resolved.
  useEffect(() => {
    if (!hasHydrated.current && !isLoading && !hasUserEdited.current) {
      setInputValue((settingValue || defaultValue) as T);
      hasHydrated.current = true;
    }
  }, [defaultValue, isLoading, settingValue]);

  const debouncedSaveSetting = useDebouncedCallback(async (value: T) => {
    const response = await updateSetting({
      key: settingName,
      value: value as EnterpriseSettingValue<typeof settingName>,
      toast: false,
    });
    if (response.error) {
      sendErrorToast(
        c("{0} is the setting name")
          .t`Failed to update setting: ${settingName}`,
      );
    }
  }, SAVE_DEBOUNCE_MS);

  const handleInputChange = useCallback(
    (newValue: T) => {
      hasUserEdited.current = true;
      setInputValue(newValue);
      debouncedSaveSetting(newValue);
    },
    [debouncedSaveSetting],
  );

  return {
    inputValue,
    handleInputChange,
  };
}
