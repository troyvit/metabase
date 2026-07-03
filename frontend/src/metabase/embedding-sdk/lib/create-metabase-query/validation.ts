import { isObject } from "metabase-types/guards";

import type {
  MetricQueryInput,
  QueryInput,
  TableQueryInput,
} from "./input-types";

export function validateQueryInput(input: QueryInput) {
  validateLimit(input.limit, getQueryContext(input));

  if (isMetricQueryInput(input)) {
    validateMetricScopedInputs(input);
  } else if (isTableQueryInput(input)) {
    validateTableScopedInputs(input);
  }
}

function validateLimit(limit: number | undefined, context: string) {
  if (limit == null) {
    return;
  }

  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error(`${context} limit must be a positive integer.`);
  }
}

function getQueryContext(input: QueryInput) {
  return input.source.type === "metric" ? "Metric query" : "Table query";
}

function isMetricQueryInput(input: QueryInput): input is MetricQueryInput {
  return input.source.type === "metric";
}

function isTableQueryInput(input: QueryInput): input is TableQueryInput {
  return input.source.type === "table";
}

function validateTableScopedInputs(input: TableQueryInput) {
  const tableId = input.source.id;

  input.fields?.forEach((field) => {
    validateGeneratedTableId(getTableId(field), tableId, "Table query fields");
  });

  input.filters?.forEach((filter) => {
    if (isTableScopedReference(filter)) {
      validateGeneratedTableId(
        getTableId(filter),
        tableId,
        "Table query filters",
      );
      return;
    }

    validateGeneratedTableId(
      getTableId(getFirstOperatorArg(filter)),
      tableId,
      "Table query filters",
    );
  });

  input.aggregations?.forEach((aggregation) => {
    if (isTableScopedReference(aggregation)) {
      validateGeneratedTableId(
        getTableId(aggregation),
        tableId,
        "Table query aggregations",
      );
      return;
    }

    validateGeneratedTableId(
      getTableId(getFirstOperatorArg(aggregation)),
      tableId,
      "Table query aggregations",
    );
  });

  input.breakouts?.forEach((breakout) => {
    validateGeneratedTableId(
      getTableId(breakout),
      tableId,
      "Table query breakouts",
    );
  });

  input.orderBys?.forEach((orderBy) => {
    if (isAggregationResultReference(input.aggregations, orderBy)) {
      return;
    }

    if (
      isGroupedQuery(input) &&
      !isBreakoutReference(input.breakouts, orderBy)
    ) {
      throw new Error(
        "Table query orderBys for grouped queries must use query breakouts or aggregations included in the query.",
      );
    }

    validateGeneratedTableId(
      getTableId(orderBy),
      tableId,
      "Table query orderBys",
    );
  });
}

function validateGeneratedTableId(
  actualTableId: number | undefined,
  expectedTableId: number,
  context: string,
) {
  if (actualTableId == null || actualTableId === expectedTableId) {
    return;
  }

  throw new Error(
    `${context} must belong to source table ${expectedTableId}, but received table id ${actualTableId}.`,
  );
}

function validateMetricScopedInputs(input: MetricQueryInput) {
  const allowedTableIds = getMetricAllowedTableIds(input.source);

  input.filters?.forEach((filter) => {
    if (isTableScopedReference(filter)) {
      validateSourceCardMetricReference(input, filter, "Metric query filters");
      validateGeneratedTableIdInSet(
        getTableId(filter),
        allowedTableIds,
        "Metric query filters",
      );
      return;
    }

    validateMetricDimension(
      input,
      getFirstOperatorArg(filter),
      "Metric query filters",
    );
  });

  input.aggregations?.forEach((aggregation) => {
    if (isCountAggregation(aggregation)) {
      return;
    }

    if (isTableScopedReference(aggregation)) {
      validateSourceCardMetricReference(
        input,
        aggregation,
        "Metric query aggregations",
      );
      validateGeneratedTableIdInSet(
        getTableId(aggregation),
        allowedTableIds,
        "Metric query aggregations",
      );
      return;
    }

    validateMetricDimension(
      input,
      getFirstOperatorArg(aggregation),
      "Metric query aggregations",
    );
  });

  input.breakouts?.forEach((breakout) => {
    validateMetricDimension(input, breakout, "Metric query breakouts");
  });

  input.orderBys?.forEach((orderBy) => {
    if (isAggregationResultReference(input.aggregations, orderBy)) {
      return;
    }

    if (
      isGroupedQuery(input) &&
      !isBreakoutReference(input.breakouts, orderBy)
    ) {
      throw new Error(
        "Metric query orderBys for grouped queries must use query breakouts or aggregations included in the query.",
      );
    }

    validateMetricDimension(input, orderBy, "Metric query orderBys");
  });
}

function validateGeneratedTableIdInSet(
  actualTableId: number | undefined,
  expectedTableIds: readonly number[] | null,
  context: string,
) {
  if (
    actualTableId == null ||
    expectedTableIds == null ||
    expectedTableIds.includes(actualTableId)
  ) {
    return;
  }

  throw new Error(
    `${context} must belong to one of the Metric's mapped tables. Expected table id ${actualTableId} to be one of ${expectedTableIds.join(
      ", ",
    )}.`,
  );
}

function isTableScopedReference(value: unknown): value is { tableId?: number } {
  return isObject(value) && "tableId" in value;
}

function getFirstOperatorArg(value: unknown) {
  if (
    !isObject(value) ||
    value.type !== "operator" ||
    !Array.isArray(value.args)
  ) {
    return undefined;
  }

  return value.args[0];
}

function isCountAggregation(value: unknown) {
  return (
    isObject(value) &&
    value.type === "operator" &&
    value.operator === "count" &&
    Array.isArray(value.args) &&
    value.args.length === 0
  );
}

function isGroupedQuery(input: QueryInput) {
  return Boolean(input.aggregations?.length || input.breakouts?.length);
}

function isAggregationResultReference(
  aggregations: QueryInput["aggregations"] | undefined,
  value: unknown,
) {
  if (
    !isObject(value) ||
    value.type !== "column" ||
    typeof value.name !== "string"
  ) {
    return false;
  }

  return getAggregationResultColumnNames(aggregations).includes(value.name);
}

function getAggregationResultColumnNames(
  aggregations: QueryInput["aggregations"] | undefined,
) {
  return (aggregations ?? []).flatMap((aggregation) => {
    if (isCountAggregation(aggregation)) {
      return ["count"];
    }

    const columns = getColumns(aggregation);

    if (!columns) {
      return [];
    }

    return columns.flatMap((column) =>
      isObject(column) && typeof column.name === "string" ? [column.name] : [],
    );
  });
}

function getColumns(value: unknown) {
  if (!isObject(value) || !("columns" in value)) {
    return null;
  }

  return Array.isArray(value.columns) ? value.columns : null;
}

function isBreakoutReference(
  breakouts: QueryInput["breakouts"] | undefined,
  value: unknown,
) {
  if (!isObject(value)) {
    return false;
  }

  return (breakouts ?? []).some((breakout) => fieldsMatch(breakout, value));
}

function getTableId(value: unknown): number | undefined {
  if (!isTableScopedReference(value) || typeof value.tableId !== "number") {
    return undefined;
  }

  return value.tableId;
}

function getMetricAllowedTableIds(metric: MetricQueryInput["source"]) {
  if (metric.mappedTableIds?.length) {
    return metric.mappedTableIds;
  }

  if (metric.sourceTableId != null) {
    return [metric.sourceTableId];
  }

  return null;
}

function validateMetricDimension(
  input: MetricQueryInput,
  value: unknown,
  context: string,
) {
  if (!isObject(value)) {
    throw new Error(`${context} must use generated metric dimensions.`);
  }

  const dimension = getMetricDimensionFields(input).find((dimension) =>
    fieldsMatch(dimension, value),
  );

  if (!dimension) {
    throw new Error(`${context} must use generated metric dimensions.`);
  }

  validateSourceCardMetricReference(input, value, context);

  validateGeneratedTableIdInSet(
    getTableId(value),
    getMetricAllowedTableIds(input.source),
    context,
  );
}

function validateSourceCardMetricReference(
  input: MetricQueryInput,
  value: unknown,
  context: string,
) {
  if (input.source.sourceCardId == null || getTableId(value) == null) {
    return;
  }

  throw new Error(
    `${context} for source-card Metrics must use generated source-card Metric dimensions, not mapped table dimensions.`,
  );
}

function getMetricDimensionFields(input: MetricQueryInput) {
  return Object.values(input.source.dimensions ?? {}).flatMap(
    (dimensionGroup) => Object.values(dimensionGroup),
  );
}

function fieldsMatch(left: unknown, right: Record<string, unknown>) {
  if (!isObject(left)) {
    return false;
  }

  const leftTableId = getTableId(left);
  const rightTableId = getTableId(right);
  const leftFieldId = typeof left.fieldId === "number" ? left.fieldId : null;
  const rightFieldId = typeof right.fieldId === "number" ? right.fieldId : null;

  return (
    leftTableId === rightTableId &&
    ((leftFieldId != null && leftFieldId === rightFieldId) ||
      left.name === right.name)
  );
}
