export const REJECT_REASONS = [
  {
    label: "Amount does not match",
    text: "The screenshot shows a different amount from the total due. Please transfer the difference and upload both receipts.",
  },
  {
    label: "Transfer not found in our account",
    text: "We could not find this transfer in our account. Please check it was sent to the correct address and upload the confirmation that shows the transaction ID.",
  },
  {
    label: "Screenshot unclear or cropped",
    text: "The screenshot is cropped or unreadable. Please upload a full screenshot showing amount, recipient, date and transaction ID.",
  },
  {
    label: "Wrong recipient",
    text: "This transfer went to a different recipient. Please contact your bank and send the payment to the details on your booking page.",
  },
  { label: "Other", text: "" },
];
