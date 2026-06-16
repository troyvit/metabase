import { useCallback } from "react";

import {
  useClearGroupMembershipMutation,
  useDeletePermissionsGroupMutation,
  useListPermissionsGroupsQuery,
  useUpdateSettingMutation,
} from "metabase/api";
import { useSelector } from "metabase/redux";
import { getSetting } from "metabase/selectors/settings";
import type { GroupId, GroupInfo } from "metabase-types/api";
import type { Settings } from "metabase-types/api/settings";

import { GroupMappingsWidgetView } from "./GroupMappingsWidgetView";

const EMPTY_GROUP_LIST: GroupInfo[] = [];

type GroupMappingsWidgetProps = {
  mappingSetting: string;
  [key: string]: unknown;
};

export function GroupMappingsWidget(props: GroupMappingsWidgetProps) {
  const [updateSetting] = useUpdateSettingMutation();
  const { data } = useListPermissionsGroupsQuery({});
  const allGroups = data ?? EMPTY_GROUP_LIST;
  const mappings = useSelector(
    (state) =>
      (getSetting(state, props.mappingSetting as keyof Settings) as
        | Record<string, GroupId[]>
        | undefined) ?? {},
  );

  const [deletePermissionsGroup] = useDeletePermissionsGroupMutation();
  const [clearGroupMembership] = useClearGroupMembershipMutation();

  const deleteGroup = useCallback(
    ({ id }: { id: GroupId }) => deletePermissionsGroup(id).unwrap(),
    [deletePermissionsGroup],
  );
  const clearGroupMember = useCallback(
    ({ id }: { id: GroupId }) => clearGroupMembership(id).unwrap(),
    [clearGroupMembership],
  );
  const handleUpdateSetting = useCallback(
    async (args: { key: string; value: Record<string, GroupId[]> }) => {
      await updateSetting(args as Parameters<typeof updateSetting>[0]).unwrap();
    },
    [updateSetting],
  );

  return (
    <GroupMappingsWidgetView
      {...(props as unknown as React.ComponentProps<
        typeof GroupMappingsWidgetView
      >)}
      allGroups={allGroups}
      mappings={mappings}
      deleteGroup={deleteGroup}
      clearGroupMember={clearGroupMember}
      updateSetting={handleUpdateSetting}
    />
  );
}
