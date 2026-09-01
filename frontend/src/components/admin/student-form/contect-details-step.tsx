"use client"

import { useController, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/form/FormField"
import { FormSelect } from "@/components/form/FormSelect"
import { formatCnicDashed } from "@/lib/validation/common"

import { getCountries, getCountryCallingCode } from "libphonenumber-js"
import type { StudentCreateInput } from "@/lib/validation/schemas/student.schema"

interface ContactDetailsStepProps {
  register: UseFormRegister<StudentCreateInput>
  control: Control<StudentCreateInput>
  errors: FieldErrors<StudentCreateInput>
  formOptions?: any
  fatherStatus: string
}

const countryCodesList = (() => {
  try {
    const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

    const getFlagEmoji = (countryCode: string) => {
      return countryCode
        .toUpperCase()
        .replace(/./g, char => String.fromCodePoint(127397 + char.charCodeAt(0)));
    };

    return getCountries()
      .map(country => ({
        label: `${getFlagEmoji(country)} ${regionNames.of(country)} (+${getCountryCallingCode(country)})`,
        value: `+${getCountryCallingCode(country)}`,
        iso: country
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  } catch (e) {
    return [
      { label: "🇵🇰 Pakistan (+92)", value: "+92", iso: "PK" },
      { label: "🇺🇸 United States (+1)", value: "+1", iso: "US" },
    ];
  }
})();

const PhoneInputWithCode = ({
  id,
  label,
  value,
  required = false,
  error,
  onChange
}: {
  id: string,
  label: string,
  value: string,
  required?: boolean,
  error?: string,
  onChange: (val: string) => void
}) => {
  const parts = (value || "").split(" ")
  const currentCode = parts.length > 1 ? parts[0] : "+92"
  const currentNum = parts.length > 1 ? parts[1] : (value || "").replace(/^\+\d+\s?/, "")

  const handleCodeChange = (code: string) => {
    onChange(`${code} ${currentNum}`)
  }

  const handleNumChange = (num: string) => {
    let cleanNum = num.replace(/\D/g, '')
    if (cleanNum.startsWith('0')) {
      cleanNum = cleanNum.substring(1)
    }
    cleanNum = cleanNum.slice(0, 11)
    onChange(`${currentCode} ${cleanNum}`)
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label} {required && "*"}</Label>
      <div className="flex gap-2">
        <Select value={currentCode} onValueChange={handleCodeChange}>
          <SelectTrigger className="w-[100px] border-2">
            <SelectValue>{currentCode || "+92"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {countryCodesList.map((c: any) => (
              <SelectItem key={`${c.iso}-${c.value}`} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          id={id}
          value={currentNum}
          onChange={(e) => handleNumChange(e.target.value)}
          className={`flex-1 ${error ? "border-red-500" : ""}`}
          placeholder="3XX-XXXXXXX"
          maxLength={11}
        />
      </div>
      {error && (
        <p className="text-sm text-red-600 mt-1">{error}</p>
      )}
    </div>
  )
}

function ControlledPhone({
  control,
  name,
  label,
  required,
  error,
}: {
  control: Control<StudentCreateInput>
  name: "phoneNumber" | "emergencyContact" | "fatherContact" | "motherContact" | "guardianContact"
  label: string
  required?: boolean
  error?: string
}) {
  const { field } = useController({ control, name })
  return (
    <PhoneInputWithCode
      id={name}
      label={label}
      required={required}
      value={field.value || ""}
      error={error}
      onChange={field.onChange}
    />
  )
}

export function ContactDetailsStep({ register, control, errors, formOptions, fatherStatus }: ContactDetailsStepProps) {
  const fatherCnicRegister = register("fatherCNIC", {
    onChange: (e) => { e.target.value = formatCnicDashed(e.target.value) },
  })
  const guardianCnicRegister = register("guardianCNIC", {
    onChange: (e) => { e.target.value = formatCnicDashed(e.target.value) },
  })

  return (
    <Card className="border-2 bg-white">
      <CardHeader>
        <CardTitle>Family & Contact Details</CardTitle>
        <p className="text-sm text-gray-600">Fields marked with * are required. Pakistan numbers (+92) must be exactly 10 digits (without leading 0).</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <ControlledPhone control={control} name="phoneNumber" label="Student's Own Phone Number" error={errors.phoneNumber?.message} />

          <ControlledPhone control={control} name="emergencyContact" label="Emergency Contact Number" required error={errors.emergencyContact?.message} />

          <FormSelect
            control={control}
            name="emergency_relationship"
            label="Relative's Relation to Student (Emergency Contact)"
            placeholder="Select relationship"
            options={(formOptions?.emergency_relationship || []).map((o: any) => ({ value: o.value, label: o.label }))}
          />

          <FormSelect
            control={control}
            name="fatherStatus"
            label="Father Status"
            placeholder="Select status"
            options={(formOptions?.father_status || []).map((o: any) => ({ value: o.value, label: o.label }))}
          />

          <FormField label="Father Name" {...register("fatherName")} error={errors.fatherName} placeholder="Enter father's full name" />

          <FormField
            label="Father CNIC"
            {...fatherCnicRegister}
            error={errors.fatherCNIC}
            placeholder="XXXXX-XXXXXXX-X"
            maxLength={15}
          />

          <ControlledPhone control={control} name="fatherContact" label="Father Contact Number" error={errors.fatherContact?.message} />

          <FormField label="Father Profession" {...register("fatherProfession")} error={errors.fatherProfession} placeholder="Enter father's profession" />

          {fatherStatus === "dead" && (
            <>
              <div className="col-span-full border-t pt-4 mt-2">
                <h3 className="text-md font-semibold text-primary">Guardian Information (Required)</h3>
              </div>

              <FormField label="Guardian Name" required {...register("guardianName")} error={errors.guardianName} placeholder="Enter guardian's full name" />

              <FormField label="Guardian's Relation to Student" required {...register("guardianRelation")} error={errors.guardianRelation} placeholder="e.g. Uncle, Grandfather" />

              <FormField
                label="Guardian CNIC"
                required
                {...guardianCnicRegister}
                error={errors.guardianCNIC}
                placeholder="XXXXX-XXXXXXX-X"
                maxLength={15}
              />

              <ControlledPhone control={control} name="guardianContact" label="Guardian Phone Number" required error={errors.guardianContact?.message} />

              <FormField label="Guardian Profession" required {...register("guardianProfession")} error={errors.guardianProfession} placeholder="Enter profession" />
            </>
          )}

          <FormField label="Mother Name" {...register("motherName")} error={errors.motherName} placeholder="Enter mother's full name" />

          <ControlledPhone control={control} name="motherContact" label="Mother Contact Number" error={errors.motherContact?.message} />

          <FormField
            label="Number of Siblings Enrolled in School"
            required
            type="number"
            min="0"
            {...register("siblingsCount")}
            error={errors.siblingsCount}
            placeholder="Enter siblings currently enrolled in school"
          />

          <FormField
            label="Monthly Family Income (PKR)"
            type="number"
            min="0"
            {...register("familyIncome")}
            error={errors.familyIncome}
            placeholder="Enter monthly income"
          />

          <FormSelect
            control={control}
            name="houseOwned"
            label="House Owned"
            placeholder="Select option"
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ]}
          />

          <FormSelect
            control={control}
            name="zakatStatus"
            label="Zakat Status"
            placeholder="Select status"
            options={[
              { value: "applicable", label: "Applicable" },
              { value: "not_applicable", label: "Not Applicable" },
            ]}
          />
        </div>

        <FormField
          as="textarea"
          label="Address"
          {...register("address")}
          error={errors.address}
          placeholder="Enter complete address"
          rows={3}
        />
      </CardContent>
    </Card>
  )
}
