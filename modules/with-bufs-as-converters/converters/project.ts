import { Codec, FromFn, ToFn } from "../types";

import {
  fromArray,
  fromNullable,
  fromObject,
  toArray,
  toNullable,
  toObject,
} from "./base";
import { fromJSONContent, toJSONContent } from "./json-content";

import {
  Project,
  ProjectAnnouncement,
  ProjectBasics,
  ProjectBenefits,
  ProjectBenefitTier,
  ProjectDescription,
  ProjectImage,
} from "@/modules/business-types";

/** Converts `ProjectDescription` to `WithBufsAs<ProjectDescription, V>`. */
export function fromProjectDescription<V>(
  codec: Codec<V>
): FromFn<ProjectDescription, V> {
  return fromObject({
    body: fromJSONContent(codec),
  });
}

/** Converts `WithBufsAs<ProjectDescription, V>` to `ProjectDescription` */
export function toProjectDescription<V>(
  codec: Codec<V>
): ToFn<ProjectDescription, V> {
  return toObject({
    body: toJSONContent(codec),
  });
}

/** Converts `ProjectImage` to `WithBufsAs<ProjectImage, V>`. */
export function fromProjectImage<V>(codec: Codec<V>): FromFn<ProjectImage, V> {
  return fromObject<ProjectImage, V>({
    url: codec.fromUrl,
  });
}

/** Converts `WithBufsAs<ProjectImage, V>` to `ProjectImage` */
export function toProjectImage<V>(codec: Codec<V>): ToFn<ProjectImage, V> {
  return toObject<ProjectImage, V>({
    url: codec.toUrl,
  });
}

/** Converts `ProjectBasics` to `WithBufsAs<ProjectBasics, V>`. */
export function fromProjectBasics<V>(
  codec: Codec<V>
): FromFn<ProjectBasics, V> {
  return fromObject<ProjectBasics, V>({
    coverImages: fromArray(fromProjectImage(codec)),
    logoImage: fromNullable(fromProjectImage(codec)),
  });
}

/** Converts `WithBufsAs<ProjectBasics, V>` to `ProjectBasics` */
export function toProjectBasics<V>(codec: Codec<V>): ToFn<ProjectBasics, V> {
  return toObject<ProjectBasics, V>({
    coverImages: toArray(toProjectImage(codec)),
    logoImage: toNullable(toProjectImage(codec)),
  });
}

/** Converts `ProjectBenefitTier` to `WithBufsAs<ProjectBenefitTier, V>`. */
export function fromProjectBenefitTier<V>(
  codec: Codec<V>
): FromFn<ProjectBenefitTier, V> {
  return fromObject<ProjectBenefitTier, V>({
    body: fromJSONContent(codec),
  });
}

/** Converts `WithBufsAs<ProjectBenefitTier, V>` to `ProjectBenefitTier` */
export function toProjectBenefitTier<V>(
  codec: Codec<V>
): ToFn<ProjectBenefitTier, V> {
  return toObject<ProjectBenefitTier, V>({ body: toJSONContent(codec) });
}

/** Converts `ProjectBenefits` to `WithBufsAs<ProjectBenefits, V>`. */
export function fromProjectBenefits<V>(
  codec: Codec<V>
): FromFn<ProjectBenefits | undefined, V> {
  return fromNullable(
    fromObject<ProjectBenefits, V>({
      perks: fromJSONContent(codec),
      tiers: fromNullable(fromArray(fromProjectBenefitTier(codec))),
    })
  );
}

/** Converts `WithBufsAs<ProjectBenefits, V>` to `ProjectBenefits` */
export function toProjectBenefits<V>(
  codec: Codec<V>
): ToFn<ProjectBenefits | undefined, V> {
  return toNullable(
    toObject<ProjectBenefits, V>({
      perks: toJSONContent(codec),
      tiers: toNullable(toArray(toProjectBenefitTier(codec))),
    })
  );
}

/**
 * Converts `Project` to `WithBufsAs<Project, V>`.
 *
 * Examples:
 * ```
 * // project: Project
 * const projectWBA: WithBufsAs<Project, Blob> =
 *   await fromProject(CodecBlob)(project);
 * ```
 */
export function fromProject<V>(codec: Codec<V>): FromFn<Project, V> {
  return fromObject<Project, V>({
    description: fromProjectDescription(codec),
    basics: fromProjectBasics(codec),
    benefits: fromProjectBenefits(codec),
  });
}

/**
 * Converts `WithBufsAs<Project, V>` to `Project`.
 *
 * Examples:
 * ```
 * // projectWBA: WithBufsAs<Project, CodecBlob>
 * const project: Project = toProject(CodecBlob)(projectWBA);
 * ```
 */
export function toProject<V>(codec: Codec<V>): ToFn<Project, V> {
  return toObject<Project, V>({
    description: toProjectDescription(codec),
    basics: toProjectBasics(codec),
    benefits: toProjectBenefits(codec),
  });
}

/** Converts `ProjectAnnouncement` to `WithBufsAs<ProjectCommunityUpdate, V>`. */
export function fromProjectAnnouncement<V>(
  codec: Codec<V>
): FromFn<ProjectAnnouncement, V> {
  return fromObject<ProjectAnnouncement, V>({
    body: fromJSONContent(codec),
  });
}

/** Converts `WithBufsAs<ProjectAnnouncement, V>` to `ProjectAnnouncement` */
export function toProjectAnnouncement<V>(
  codec: Codec<V>
): ToFn<ProjectAnnouncement, V> {
  return toObject<ProjectAnnouncement, V>({
    body: toJSONContent(codec),
  });
}

/** @deprecated Use `toProjectAnnouncement` instead. */
export const toProjectCommunityUpdate = toProjectAnnouncement;
