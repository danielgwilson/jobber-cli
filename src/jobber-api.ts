import { DEFAULT_API_URL, DEFAULT_GRAPHQL_VERSION, type JobberConfig } from "./config.js";

export type GraphqlRequest = {
  operationName?: string;
  query: string;
  variables?: Record<string, unknown>;
};

export type GraphqlResponse<TData = unknown> = {
  data?: TData;
  errors?: Array<{ message?: string; path?: Array<string | number>; extensions?: Record<string, unknown> }>;
};

export class JobberApiError extends Error {
  status?: number;
  data?: unknown;

  constructor(message: string, init: { status?: number; data?: unknown } = {}) {
    super(message);
    this.name = "JobberApiError";
    this.status = init.status;
    this.data = init.data;
  }
}

export type JobberApiClientOptions = {
  cookieHeader: string;
  graphqlVersion?: string;
  apiUrl?: string;
  userAgent?: string;
};

export const CLIENT_DEFAULTS_QUERY = `query ClientDefaults {
  clientCustomFields: customFieldConfigurations(filter: {appliesTo: ALL_CLIENTS}) {
    nodes {
      ...CustomFieldConfiguration
      __typename
    }
    __typename
  }
  propertyCustomFields: customFieldConfigurations(filter: {appliesTo: ALL_PROPERTIES}) {
    nodes {
      ...CustomFieldConfiguration
      __typename
    }
    __typename
  }
}

fragment CustomFieldConfiguration on CustomFieldConfiguration {
  ... on CustomFieldConfigurationDropdown {
    ...DropdownConfiguration
    __typename
  }
  ... on CustomFieldConfigurationText {
    ...TextConfiguration
    __typename
  }
  ... on CustomFieldConfigurationArea {
    ...AreaConfiguration
    __typename
  }
  ... on CustomFieldConfigurationTrueFalse {
    ...TrueFalseConfiguration
    __typename
  }
  ... on CustomFieldConfigurationLink {
    ...LinkConfiguration
    __typename
  }
  ... on CustomFieldConfigurationNumeric {
    ...NumericConfiguration
    __typename
  }
  __typename
}

fragment AreaConfiguration on CustomFieldConfigurationArea {
  ...BaseCustomFieldConfiguration
  areaDefault: defaultValue {
    length
    width
    __typename
  }
  areaUnit: unit
  __typename
}

fragment BaseCustomFieldConfiguration on CustomFieldConfigurationInterface {
  id
  name
  sortOrder
  readOnly
  archived
  app {
    ...ApplicationNameLogo
    __typename
  }
  transferedFrom {
    ...transferedFrom
    __typename
  }
  __typename
}

fragment ApplicationNameLogo on Application {
  id
  logoUrl
  name
  __typename
}

fragment transferedFrom on CustomFieldConfigurationInterface {
  id
  __typename
}

fragment LinkConfiguration on CustomFieldConfigurationLink {
  ...BaseCustomFieldConfiguration
  linkDefault: defaultValue {
    text
    url
    __typename
  }
  __typename
}

fragment DropdownConfiguration on CustomFieldConfigurationDropdown {
  ...BaseCustomFieldConfiguration
  dropdownDefault: defaultValue
  dropdownOptions
  __typename
}

fragment TrueFalseConfiguration on CustomFieldConfigurationTrueFalse {
  ...BaseCustomFieldConfiguration
  trueFalseDefault: defaultValue
  __typename
}

fragment TextConfiguration on CustomFieldConfigurationText {
  ...BaseCustomFieldConfiguration
  textDefault: defaultValue
  __typename
}

fragment NumericConfiguration on CustomFieldConfigurationNumeric {
  ...BaseCustomFieldConfiguration
  numericDefault: defaultValue
  numericUnit: unit
  __typename
}`;

export const CURRENT_ACCOUNT_QUERY = `query CurrentAccount {
  account {
    id
    name
    createdAt
    inTrial
    industry
    tester
    settings {
      calendar {
        calendarFirstDay
      }
      localization {
        countryCode
        languageCode
      }
    }
  }
}`;

export const CURRENT_USER_QUERY = `query getCurrentUserQueryData(
  $fullName: Boolean!
  $isOwner: Boolean!
  $isAdmin: Boolean!
  $email: Boolean!
) {
  user {
    id
    fullName @include(if: $fullName)
    isOwner @include(if: $isOwner)
    isAdmin @include(if: $isAdmin)
    email @include(if: $email) {
      raw
      isValid
    }
  }
}`;

export class JobberApiClient {
  private readonly cookieHeader: string;
  private readonly graphqlVersion: string;
  private readonly apiUrl: string;
  private readonly userAgent: string;

  constructor(options: JobberApiClientOptions) {
    this.cookieHeader = options.cookieHeader.trim();
    this.graphqlVersion = options.graphqlVersion || DEFAULT_GRAPHQL_VERSION;
    this.apiUrl = options.apiUrl || DEFAULT_API_URL;
    this.userAgent = options.userAgent || "jobber-cli/0.1.0";
  }

  static fromConfig(config: JobberConfig): JobberApiClient {
    if (!config.cookieHeader?.trim()) {
      const error = new JobberApiError("No Jobber auth configured");
      (error as any).code = "AUTH_MISSING";
      throw error;
    }
    return new JobberApiClient({
      cookieHeader: config.cookieHeader,
      graphqlVersion: config.graphqlVersion,
      apiUrl: config.apiUrl,
    });
  }

  async graphql<TData = unknown>(request: GraphqlRequest): Promise<GraphqlResponse<TData>> {
    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        accept: "*/*",
        "content-type": "application/json",
        cookie: this.cookieHeader,
        "x-jobber-graphql-version": this.graphqlVersion,
        "user-agent": this.userAgent,
      },
      body: JSON.stringify({
        operationName: request.operationName,
        query: request.query,
        variables: request.variables || {},
      }),
    });

    const text = await response.text();
    let payload: GraphqlResponse<TData> | string = text;
    try {
      payload = JSON.parse(text) as GraphqlResponse<TData>;
    } catch {
      payload = text;
    }

    if (!response.ok) {
      throw new JobberApiError(`Jobber GraphQL request failed with ${response.status}`, {
        status: response.status,
        data: payload,
      });
    }

    if (typeof payload === "string") {
      throw new JobberApiError("Jobber GraphQL returned non-JSON response", {
        status: response.status,
        data: payload,
      });
    }

    if (payload.errors?.length) {
      throw new JobberApiError(payload.errors[0]?.message || "Jobber GraphQL returned errors", {
        status: response.status,
        data: payload,
      });
    }

    return payload;
  }

  async validateAuth(): Promise<{ ok: true; graphqlVersion: string; customFieldCounts: { client: number; property: number } }> {
    const payload = await this.graphql<{
      clientCustomFields?: { nodes?: unknown[] };
      propertyCustomFields?: { nodes?: unknown[] };
    }>({
      operationName: "ClientDefaults",
      query: CLIENT_DEFAULTS_QUERY,
      variables: {},
    });

    return {
      ok: true,
      graphqlVersion: this.graphqlVersion,
      customFieldCounts: {
        client: payload.data?.clientCustomFields?.nodes?.length || 0,
        property: payload.data?.propertyCustomFields?.nodes?.length || 0,
      },
    };
  }

  async whoami(): Promise<{
    graphqlVersion: string;
    user: {
      id?: string;
      fullName?: string;
      isOwner?: boolean;
      isAdmin?: boolean;
      email?: { raw?: string; isValid?: boolean };
    };
    account: {
      id?: string;
      name?: string;
      createdAt?: string;
      inTrial?: boolean;
      industry?: string;
      tester?: boolean;
      settings?: {
        calendar?: { calendarFirstDay?: string };
        localization?: { countryCode?: string; languageCode?: string };
      };
    };
  }> {
    const [userPayload, accountPayload] = await Promise.all([
      this.graphql<{
        user?: {
          id?: string;
          fullName?: string;
          isOwner?: boolean;
          isAdmin?: boolean;
          email?: { raw?: string; isValid?: boolean };
        };
      }>({
        operationName: "getCurrentUserQueryData",
        query: CURRENT_USER_QUERY,
        variables: {
          fullName: true,
          isOwner: true,
          isAdmin: true,
          email: true,
        },
      }),
      this.graphql<{
        account?: {
          id?: string;
          name?: string;
          createdAt?: string;
          inTrial?: boolean;
          industry?: string;
          tester?: boolean;
          settings?: {
            calendar?: { calendarFirstDay?: string };
            localization?: { countryCode?: string; languageCode?: string };
          };
        };
      }>({
        operationName: "CurrentAccount",
        query: CURRENT_ACCOUNT_QUERY,
        variables: {},
      }),
    ]);

    return {
      graphqlVersion: this.graphqlVersion,
      user: userPayload.data?.user || {},
      account: accountPayload.data?.account || {},
    };
  }
}
