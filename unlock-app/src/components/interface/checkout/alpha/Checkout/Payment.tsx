import { CheckoutService } from './checkoutMachine'
import { Connected } from '../Connected'
import { useConfig } from '~/utils/withConfig'
import { useActor } from '@xstate/react'
import { useAuth } from '~/contexts/AuthenticationContext'
import {
  BackButton,
  CheckoutHead,
  CheckoutTransition,
  CloseButton,
} from '../Shell'
import { PoweredByUnlock } from '../PoweredByUnlock'
import { useCheckoutHeadContent } from '../useCheckoutHeadContent'
import { IconButton, ProgressCircleIcon, ProgressFinishIcon } from '../Progress'
import { RiArrowRightLine as RightArrowIcon } from 'react-icons/ri'
import { useQuery } from 'react-query'
import { getFiatPricing } from '~/hooks/useCards'
import { lockTickerSymbol } from '~/utils/checkoutLockUtils'
import dynamic from 'next/dynamic'
import { useWalletService } from '~/utils/withWalletService'
import { useEffect, useState } from 'react'
import { BigNumber, ethers } from 'ethers'
import {
  RiVisaLine as VisaIcon,
  RiMastercardLine as MasterCardIcon,
} from 'react-icons/ri'

const CryptoIcon = dynamic(() => import('react-crypto-icons'), {
  ssr: false,
})

interface Props {
  injectedProvider: unknown
  checkoutService: CheckoutService
  onClose(params?: Record<string, string>): void
}

export function Payment({ injectedProvider, checkoutService, onClose }: Props) {
  const [state, send] = useActor(checkoutService)
  const config = useConfig()
  const { title, description, iconURL } =
    useCheckoutHeadContent(checkoutService)
  const { paywallConfig, quantity } = state.context
  const lock = state.context.lock!
  const wallet = useWalletService()
  const { account } = useAuth()
  const [balance, setBalance] = useState<BigNumber | null>(null)
  const baseSymbol = config.networks[lock.network].baseCurrencySymbol
  const symbol = lockTickerSymbol(lock, baseSymbol).toLowerCase()
  const keyPriceBig = ethers.utils.parseEther(lock.keyPrice)
  const isPayable = balance?.gt(keyPriceBig)
  const remainder = balance?.mod(1e12)
  const balanceAmount = balance
    ? ethers.utils.formatEther(balance.sub(remainder!))
    : null

  const { isLoading, data: fiatPricing } = useQuery(
    [quantity.toString(), lock.address, lock.network],
    async () => {
      const pricing = await getFiatPricing(
        config,
        lock.address,
        lock.network,
        quantity
      )
      return pricing
    }
  )

  useEffect(() => {
    const getBalance = async () => {
      if (account) {
        const provider = wallet.providerForNetwork(lock.network)
        const ethAmount = await provider.getBalance(account)
        setBalance(ethAmount)
      }
    }
    getBalance()
  }, [account, wallet, setBalance, lock])

  return (
    <CheckoutTransition>
      <div className="bg-white max-w-md rounded-xl flex flex-col w-full h-[90vh] sm:h-[80vh] max-h-[42rem]">
        <div className="flex items-center justify-between p-6">
          <BackButton onClick={() => send('BACK')} />
          <CloseButton onClick={() => onClose()} />
        </div>
        <CheckoutHead
          title={paywallConfig.title}
          iconURL={iconURL}
          description={description}
        />
        <div className="flex px-6 p-2 flex-wrap items-center w-full gap-2">
          <div className="flex items-center gap-2 col-span-4">
            <div className="flex items-center gap-0.5">
              <IconButton
                title="Select lock"
                icon={ProgressCircleIcon}
                onClick={() => {
                  send('SELECT')
                }}
              />
              <IconButton
                title="Select Quantity"
                icon={ProgressCircleIcon}
                onClick={() => {
                  send('QUANTITY')
                }}
              />
              <ProgressCircleIcon />
            </div>
            <h4 className="text-sm"> {title}</h4>
          </div>
          <div className="border-t-4 w-full flex-1"></div>
          <div className="inline-flex items-center gap-0.5">
            <ProgressCircleIcon disabled />
            {paywallConfig.messageToSign && <ProgressCircleIcon disabled />}
            <ProgressCircleIcon disabled />
            <ProgressFinishIcon disabled />
          </div>
        </div>
        <main className="p-6 overflow-auto h-full space-y-6">
          <button
            disabled={!isPayable || isLoading}
            onClick={(event) => {
              event.preventDefault()
              send({
                type: 'SELECT_PAYMENT_METHOD',
                payment: {
                  method: 'crypto',
                },
              })
              send('CONTINUE')
            }}
            className="border flex flex-col w-full border-gray-400 space-y-2 cursor-pointer shadow p-4 rounded-lg group hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-white"
          >
            <div className="flex w-full justify-between">
              <h3 className="font-bold"> Pay by Crypto </h3>
              <div className="flex items-center gap-x-2 text-sm">
                Accept: <CryptoIcon name={symbol} size={18} />
              </div>
            </div>
            <div className="flex items-center w-full justify-between">
              <div className="text-sm">
                Your balance:
                <span className="font-bold ml-2">
                  {balanceAmount?.toString()}
                </span>
              </div>
              <div className="flex items-center justify-end">
                <RightArrowIcon
                  className="group-hover:fill-brand-ui-primary group-hover:translate-x-1 group-disabled:translate-x-0 duration-300 ease-out transition-transform group-disabled:transition-none group-disabled:group-hover:fill-black"
                  size={20}
                />
              </div>
            </div>
          </button>
          <button
            disabled={!fiatPricing?.creditCardEnabled || isLoading}
            onClick={(event) => {
              event.preventDefault()
              send({
                type: 'SELECT_PAYMENT_METHOD',
                payment: {
                  method: 'card',
                },
              })
              send('CONTINUE')
            }}
            className="border flex flex-col w-full border-gray-400 space-y-2 cursor-pointer shadow p-4 rounded-lg group hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-white"
          >
            <div className="items-center flex justify-between w-full">
              <h3 className="font-bold"> Pay by Credit Card </h3>
              <div className="flex items-center gap-x-2 text-sm">
                Accept:
                <VisaIcon size={18} />
                <MasterCardIcon size={18} />
              </div>
            </div>
            <div className="flex items-center w-full justify-between">
              <div className="text-sm text-gray-500">Powered by stripe</div>
              <div className="flex items-center justify-end">
                <RightArrowIcon
                  className="group-hover:fill-brand-ui-primary group-hover:translate-x-1 group-disabled:translate-x-0 duration-300 ease-out transition-transform group-disabled:transition-none group-disabled:group-hover:fill-black"
                  size={20}
                />
              </div>
            </div>
          </button>
        </main>
        <footer className="px-6 pt-6 border-t grid items-center">
          <Connected
            service={checkoutService}
            injectedProvider={injectedProvider}
          />
          <PoweredByUnlock />
        </footer>
      </div>
    </CheckoutTransition>
  )
}