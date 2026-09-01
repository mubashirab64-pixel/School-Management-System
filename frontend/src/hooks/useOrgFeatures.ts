import { useState, useEffect } from "react"
import { FEATURES, type FeatureKey, getAllowedNavItems, isRouteAllowed } from "@/config/features"

const NEW_FEATURE_KEYS = new Set(FEATURES.map(f => f.key))

interface OrgFeaturesState {
    features: Record<string, boolean>
    isLoaded: boolean
    /** True when the org has the new feature key format (not legacy) */
    hasFeatureConfig: boolean
    isFeatureEnabled: (key: FeatureKey) => boolean
    getAllowedNavItems: () => Set<string>
    isRouteAllowed: (pathname: string) => boolean
}

export function useOrgFeatures(): OrgFeaturesState {
    const [features, setFeatures] = useState<Record<string, boolean>>({})
    const [isLoaded, setIsLoaded] = useState(false)

    useEffect(() => {
        try {
            const raw = localStorage.getItem("sis_organization")
            if (raw) {
                const org = JSON.parse(raw)
                setFeatures(org.enabled_features ?? {})
            }
        } catch {
            // ignore parse errors
        } finally {
            setIsLoaded(true)
        }
    }, [])

    // Org has new format if at least one of our feature keys is present
    const hasFeatureConfig = Object.keys(features).some(k => NEW_FEATURE_KEYS.has(k as FeatureKey))

    return {
        features,
        isLoaded,
        hasFeatureConfig,
        isFeatureEnabled: (key: FeatureKey) => features[key] !== false,
        // If org has legacy/empty features, return empty set → sidebar skips filtering
        getAllowedNavItems: () => hasFeatureConfig ? getAllowedNavItems(features) : new Set<string>(),
        isRouteAllowed: (pathname: string) => hasFeatureConfig ? isRouteAllowed(pathname, features) : true,
    }
}
