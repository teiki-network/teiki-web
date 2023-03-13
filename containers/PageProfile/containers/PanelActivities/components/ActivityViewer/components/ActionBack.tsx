import Link from "next/link";
import * as React from "react";

import { ProjectActivityAction } from "@/modules/business-types";
import { getExplorerUrl } from "@/modules/common-utils";
import AssetViewer from "@/modules/teiki-ui/components/AssetViewer";
import Flex from "@/modules/teiki-ui/components/Flex";
import InlineAddress from "@/modules/teiki-ui/components/InlineAddress";
import Typography from "@/modules/teiki-ui/components/Typography";

type Props = {
  className?: string;
  style?: React.CSSProperties;
  value: Extract<ProjectActivityAction, { type: "back" }>;
};

export default function ActionBack({ className, style, value }: Props) {
  return (
    <Flex.Col className={className} style={style} gap="8px">
      <Typography.Div size="bodySmall" color="ink80">
        <Typography.Span fontWeight="semibold" color="ink">
          {!value.createdByHandle ? (
            <InlineAddress value={value.createdBy} length="short" />
          ) : (
            <span>{`$${value.createdByHandle}`}</span>
          )}
        </Typography.Span>
        <Typography.Span content=" staked " />
        <AssetViewer.Ada.Standard
          as="span"
          lovelaceAmount={value.lovelaceAmount}
          fontWeight="semibold"
          color="ink"
        />
        <Link href={getExplorerUrl(value.createdTx)} target="_blank">
          <Typography.Span
            content="View transaction"
            size="heading6"
            style={{
              color: "#00362C",
              textDecoration: "underline",
              marginLeft: "8px",
            }}
          />
        </Link>
      </Typography.Div>
      {value.message ? (
        <Typography.Div
          style={{
            paddingLeft: "10px",
            borderLeft: "2px solid rgba(0, 110, 70, 0.3)",
          }}
          content={value.message}
          color="ink80"
          size="bodySmall"
          maxLines={2}
        />
      ) : null}
    </Flex.Col>
  );
}
